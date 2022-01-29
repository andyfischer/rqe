
import { Graph } from '../Graph'
import { QueryTuple, QueryTag, tagsToItem } from '../Query'
import { Step } from '../Step'
import { Stream, PipeReceiver } from '../Stream'
import { runTableSearch } from '../RunningQuery'
import { StringValue } from '../TaggedValue'
import { prepareTableSearch, findBestPointMatch } from '../FindMatch'
import { Block } from '../Block'
import { c_done, c_item } from '../Enums'
import { Item, has } from '../Item'
import { withVerb } from '../Query'
import { PrepareParams } from '../Planning'
import { queryTupleToString } from '../Query'

function prepare({graph, later, tuple, incomingSchema}: PrepareParams) {

    const context = {};

    // First see if we can query RHS in side-by-side mode (ie, not using any inputs).
    const sideBySideMatch = findBestPointMatch(graph, withVerb(tuple, 'get'));

    if (sideBySideMatch) {
        // TODO
        /*
        const rhsResults = later.new_stream();
        prepareTableSearch(later, graph, withVerb(tuple, 'get'), later.new_empty_stream(), rhsResults);
        */
    }

    // Side-by-side didn't work. Find a fanout match (using incoming inputs)
    const fanoutTags: QueryTag[] = tuple.tags.map(tag => {
        // Some "no value" tags will actually have a value, once we start doing the join.
        if (tag.value.t === 'no_value') {
            for (const item of incomingSchema) {
                if (has(incomingSchema, tag.attr)) {
                    return {
                        ...tag,
                        value: {
                            t: 'abstract'
                        }
                    }
                }
            }
        }

        return tag;
    });

    const fanoutTuple: QueryTuple = { t: 'tuple', verb: 'get', tags: fanoutTags };
    const fanoutMatch = findBestPointMatch(graph, fanoutTuple);

    if (!fanoutMatch) {
        later.errorAndClose({
            errorType: 'no_table_found',
            query: fanoutTuple,
        });
        return;
    }

    later.streaming_transform(later.input(), later.output(), lhsItem => {

        // console.log('lhsItem: ', lhsItem);

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

        const tags = tuple.tags.map(tag => {
            if (tag.value.t === 'no_value' && lhsItem[tag.attr] !== undefined) {
                return {
                    ...tag,
                    value: {
                        t: 'str_value',
                        str: lhsItem[tag.attr] as string,
                    } as StringValue
                }
            } else {
                return tag;
            }
        });

        // console.log('join running subquery: ', updatedParams);

        runTableSearch(graph, context, {t: 'tuple', verb: 'get', tags },
                       Stream.newEmptyStream(), thisOutput);

        return fixedOutput;
    }, { maxConcurrency: 300 });

    // console.log('incomingSchema: ', incomingSchema);

    // prepareTableSearch(later, step.graph, step, step.tuple, later.namedInput('step_input'), later.namedInput('step_output'));
    // console.log('join has prepared', later.str())
}


export const join = {
    prepare,
}
