
import { Step } from '../Step'
import { QueryStep } from '../Query'
import { Stream } from '../Stream'
import { toTagged } from '../TaggedValue'

function run(step: Step) {
    step.input.streamingTransform(step.output, lhsItem => {

        // Kick off an update! query with this item.
        const updateStep: QueryStep = {
            t: 'step',
            verb: 'get',
            attrs: {
                'update!': {
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
            updateStep.attrs[attr] = { t: 'tag', value: toTagged(value) };
        }

        for (const [ attr, details ] of Object.entries(step.tuple.attrs)) {
            let updateParams = updateStep.attrs['update!'].value as QueryStep;
            updateParams.attrs[attr] = { t: 'tag', value: details.value };
        }

        const output = new Stream();
        step.runTableSearch(updateStep, Stream.newEmptyStream(), output);
        return output;
    });
}

export const update = {
    run
}
