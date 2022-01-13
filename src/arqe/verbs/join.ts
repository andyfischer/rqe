
import { Step } from '../Step'
import { Stream, PipeReceiver } from '../Stream'
import { runTableSearch } from '../RunningQuery'
import { StringValue } from '../TaggedValue'
import { prepareTableSearch } from '../PlannedQuery'
import { Block } from '../Block'
import { c_done, c_item } from '../Enums'

function prepare(step: Step, later: Block) {
    const mainStep = later.namedInput('step');

    let updatedStep = mainStep;
    updatedStep = later.step_with_verb(updatedStep, 'get');

    prepareTableSearch(step.graph, step, updatedStep, later);
}

function mapStreamForEachItem(forEach: (item) => Stream) {

    let incomingHasFinished = false;
    let unfinishedMappedStreams = 0;

    const output = new Stream();

    return {
        input: {
            receive(data) {
                switch (data.t) {
                case c_done:
                    incomingHasFinished = true;

                    if (incomingHasFinished && unfinishedMappedStreams === 0) {
                        // console.log('mapStreamForEachItem done (1)');
                        output.done();
                    }
                    
                    break;
                case c_item: {
                    const item = data.item;
                    // console.log('mapStreamForEachItem opening stream for', item);
                    const streamForInput = forEach(item);
                    unfinishedMappedStreams++;

                    streamForInput.sendTo({
                        receive(data) {
                        switch (data.t) {
                            case 'done':
                                // console.log('mapStreamForEachItem saw stream end');
                                unfinishedMappedStreams--;
                                if (incomingHasFinished && unfinishedMappedStreams === 0) {
                                    // console.log('mapStreamForEachItem done (2)');
                                    output.done();
                                }
                                break;
                            case 'item':
                                // console.log('mapStreamForEachItem sending', data.item);
                                output.put(data.item);
                                break;
                            }
                        }
                    });
                    break;
                }
                }
            }
        },
        output
    }
}

function run(step: Step) {

    // Run a 1-per-1 join:
    //   For each lhs result, run the rhs query.

    const { input, output } = mapStreamForEachItem(lhsItem => {

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

        const tags = step.tags.map(tag => {
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

        const updatedParams = step
                          .withVerb('get')
                          .withTags(tags)
                          .withInput(Stream.newEmptyStream())
                          .withOutput(thisOutput);

        // console.log('join running subquery: ', updatedParams);

        runTableSearch(updatedParams);

        return fixedOutput;
    });

    step.input.sendTo(input);
    output.sendTo(step.output);
}

export const join = {
    prepare,
    run,
}
