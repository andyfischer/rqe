
import Params from '../Params'
import { Stream, PipeReceiver } from '../Stream'
import { runTableSearch } from '../runQuery'
import { StringValue } from '../Query'

function mapStreamForEachItem(forEach: (item) => Stream) {

    let incomingHasFinished = false;
    let unfinishedMappedStreams = 0;

    const output = new Stream();

    return {
        input: {
            receive(data) {
                switch (data.t) {
                case 'done':
                    incomingHasFinished = true;

                    if (incomingHasFinished && unfinishedMappedStreams === 0) {
                        // console.log('mapStreamForEachItem done (1)');
                        output.done();
                    }
                    
                    break;
                case 'item': {
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

export default function join(params: Params) {

    // Run a 1-per-1 join:
    //   For each lhs result, run the rhs query.

    const { input, output } = mapStreamForEachItem(lhsItem => {

        // console.log('lhsItem: ', lhsItem);

        const thisOutput = new Stream();
        const fixedOutput = new Stream();

        thisOutput.sendTo({
            receive(data) {
                switch (data.t) {
                    case 'done':
                        // console.log('join fixedOutput done');
                        fixedOutput.done();
                        break;
                    case 'item':
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

        const tags = params.tags.map(tag => {
            if (tag.value.t === 'noValue' && lhsItem[tag.attr] !== undefined) {
                return {
                    ...tag,
                    value: {
                        t: 'strValue',
                        str: lhsItem[tag.attr] as string,
                    } as StringValue
                }
            } else {
                return tag;
            }
        });

        const updatedParams = params
                          .withVerb('get')
                          .withTags(tags)
                          .withInput(Stream.newEmptyStream())
                          .withOutput(thisOutput);

        // console.log('join running subquery: ', updatedParams);

        runTableSearch(updatedParams);

        return fixedOutput;
    });

    params.input.sendTo(input);
    output.sendTo(params.output);
}

