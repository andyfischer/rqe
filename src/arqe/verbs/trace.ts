
import { Step } from '../Step'
import { c_item } from '../Enums'
import { QueryTuple } from '../Query'

function prepare(step: Step) {
    for (const it of step.input)
        step.put(it);
}

function run(step: Step) {

    step.input.sendTo({
        receive(msg) {
            switch (msg.t) {
            case c_item:
                step.output.receive(msg);

                const tuple: QueryTuple = {
                    t: 'tuple',
                    tags: step.tuple.tags.map(tag => {
                        if (tag.attr === 'item')
                            return { t: 'tag', attr: 'item', value: { t: 'item', item: msg.item }}
                        return tag;
                    }),
                    verb: 'get',
                };

                step.graph.query(tuple);

                // TODO: should wait on query to finish.

                break;
            default:
                step.output.receive(msg);
            }
        }
    });
}

export const trace = {
    prepare,
    run,
}
