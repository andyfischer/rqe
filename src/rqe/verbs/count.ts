
import { Step } from '../Step'
import { Graph } from '../Graph'
import { QueryTuple, QueryTag, tagsToItem, withVerb } from '../Query'
import { Block } from '../Block'
import { PrepareParams } from '../Planning'

function prepare({graph, later, tuple}: PrepareParams) {
    later.planned_put(later.output(), { count: null });
}

function run(step: Step) {
    let count = 0;

    step.input.sendTo({
        receive(data) {
            switch (data.t) {

            case 'done': {
                step.output.put({ count });
                step.output.done();
                break;
            }

            case 'item': {
                count++;
                break;
            }

            default:
                step.output.receive(data);
            }
        }
    });
}

export const count = {
    prepare,
    run,
}
