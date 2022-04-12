
import { QueryStep } from '../Query'
import { Step } from '../Step'
import { Stream } from '../Stream'
import { findBestPointMatch, PointMatch } from '../FindMatch'
import { c_done, c_item } from '../Enums'
import { has } from '../Item'
import { withVerb } from '../Query'
import { mapValues } from '../utils/mapObject'
import { toTagged } from '../TaggedValue'
import { streamingAggregate } from '../Concurrency'
import { Item } from '../Item'
import { formatValue } from '../format/formatItem'
import { MultiMap } from '../utils/MultiMap'

function run(step: Step) {

    const { graph, tuple, incomingSchema } = step;
    const context = {};
    const hasLhsSchema = !!incomingSchema[0];

    // First see if we can query RHS in side-by-side mode.
    const sideBySideMatch = findBestPointMatch(graph, withVerb(tuple, 'get'));

    if (hasLhsSchema && sideBySideMatch) {
        // return runSideBySideMatch(step, sideBySideMatch);
    }

    // Side-by-side didn't work. Find a fanout match.
    const fanoutTags = mapValues(tuple.attrs, (details, attr) => {
        // Some "no value" tags will actually have a value, once we start doing the join.
        if (details.value.t === 'no_value') {
            for (const item of incomingSchema) {
                if (has(item, attr)) {
                    return {
                        ...details,
                        value: {
                            t: 'abstract'
                        }
                    }
                }
            }
        }
        return details;
    });

    const fanoutTuple: QueryStep = { t: 'step', verb: 'get', attrs: fanoutTags };
    const fanoutMatch = findBestPointMatch(graph, fanoutTuple);

    if (!fanoutMatch) {
        step.output.errorAndClose({
            errorType: 'no_table_found',
            query: fanoutTuple,
        });
        return;
    }

    runFanoutMatch(step, fanoutMatch);
}

function runSideBySideMatch(step: Step, match: PointMatch) {
    const rhsSearch: QueryStep = {t: 'step', verb: 'get', attrs: step.tuple.attrs };
    const rhsOutput = new Stream();
    step.runTableSearch(rhsSearch, Stream.newEmptyStream(), rhsOutput);

    const lhsSchema = step.incomingSchema;

    const commonAttrs = [];

    for (const attr of Object.keys(lhsSchema[0])) {
        if (match.match.attrs.has(attr)) {
            commonAttrs.push(attr);
        }
    }

    if (commonAttrs.length === 0) {
        throw new Error("Can't side-by-side match, no common attrs");
    }

    function getItemKey(item: Item) {
        const strs = [];
        for (const attr of commonAttrs) {
            strs.push(formatValue(item[attr]));
        }
        return strs.join(',');
    }

    const found = [new MultiMap(), new MultiMap()];

    const overallOutput = step.output;

    streamingAggregate([step.input, rhsOutput], event => {
        if (event.t === 'done') {
            overallOutput.done();
            return;
        }

        if (event.msg.t === 'item') {
            const otherStream = event.streamIndex === 0 ? 1 : 0;

            const item = event.msg.item;
            const key = getItemKey(item);

            // Check for match
            for (const match of found[otherStream].get(key)) {
                const fixedItem = {
                    ...item
                }

                // Include any missing attributes from the other side.
                for (const [ key, value ] of Object.entries(match)) {
                    if (fixedItem[key] === undefined)
                        fixedItem[key] = value;
                }

                overallOutput.put(fixedItem);

            }

            found[event.streamIndex].add(key, item);
            return;
        }

        if (event.msg.t === 'done')
            return;

        overallOutput.receive(event.msg);
    });

    /*
    const rhsResults = later.new_stream();
    prepareTableSearch(later, graph, withVerb(tuple, 'get'), later.new_empty_stream(), rhsResults);
    */
}

function runFanoutMatch(step: Step, fanoutMatch: PointMatch) {

    const { input, output, tuple } = step;

    input.streamingTransform(step.output, lhsItem => {

        const thisOutput = new Stream();
        const fixedOutput = new Stream();

        thisOutput.sendTo({
            receive(data) {
                switch (data.t) {
                    case c_done:
                        // console.log('join fixedOutput done');
                        fixedOutput.done();
                        break;
                    case c_item:
                        // console.log('join fixedOutput saw rhs result: ', data.item);

                        const fixedItem = {
                            ...data.item
                        }

                        // Include any attributes in the lhsItem that weren't included in the
                        // rhs result.
                        for (const [ key, value ] of Object.entries(lhsItem)) {
                            if (fixedItem[key] === undefined)
                                fixedItem[key] = value;
                        }

                        fixedOutput.put(fixedItem);
                        break;
                }
            }
        });

        const searchAttrs = mapValues(tuple.attrs, (details, attr) => {
            if (details.value.t === 'no_value' && lhsItem[attr] !== undefined) {
                return {
                    ...details,
                    value: toTagged(lhsItem[attr]),
                }
            } else {
                return details;
            }
        });

        const relatedSearch: QueryStep = {t: 'step', verb: 'get', attrs: searchAttrs };
        step.runTableSearch(relatedSearch, Stream.newEmptyStream(), thisOutput);

        return fixedOutput;
    }, { maxConcurrency: 300 });
}

export const join = {
    run,
}
