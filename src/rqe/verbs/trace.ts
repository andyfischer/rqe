
import { Step } from '../Step'
import { c_item } from '../Enums'
import { QueryStep } from '../Query'

function run(step: Step) {

    step.input.sendTo({
        receive(msg) {
            switch (msg.t) {
            case c_item:
                step.output.receive(msg);

                if (!step.schemaOnly) {

                    const fixedAttrs = { ...step.tuple.attrs }
                    if (fixedAttrs.item)
                        fixedAttrs.item = { t: 'tag', value: { t: 'item', item: msg.item }}

                    const tuple: QueryStep = {
                        t: 'step',
                        attrs: fixedAttrs,
                        verb: 'get',
                    };

                    step.graph.query(tuple);

                    // TODO: should wait on query to finish.
                }

                break;
            default:
                step.output.receive(msg);
            }
        }
    });
}

export const trace = {
    run,
}
