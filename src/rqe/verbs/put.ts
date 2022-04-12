
import { Step } from '../Step'
import { QueryStep } from '../Query'
import { toTagged } from '../TaggedValue'
import { Stream } from '../Stream'

function run(step: Step) {
    step.input.streamingTransform(step.output, lhsItem => {
        // Kick off a put! query with this item.
        const putStep: QueryStep = {
            t: 'step',
            verb: 'get',
            attrs: {
                'put!': {
                    t: 'tag',
                    value: {
                        t: 'step',
                        verb: 'get',
                        attrs: { }
                    }
                }
            },
        };

        for (const [ attr, value ] of Object.entries(lhsItem)) {
            putStep.attrs[attr] = { t: 'tag', value: toTagged(value) };
        }

        for (const [ attr, details ] of Object.entries(step.tuple.attrs)) {
            putStep.attrs[attr] = { t: 'tag', value: details.value };
        }

        const output = new Stream();
        step.runTableSearch(putStep, Stream.newEmptyStream(), output);
        return output;
    });
}

export const put = {
    run
}
