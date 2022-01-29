
import { Step } from '../Step'
import { Graph } from '../Graph'
import { QueryTuple, QueryTag, tagsToItem, withVerb } from '../Query'
import { Block } from '../Block'
import { PrepareParams } from '../Planning'

function prepare({graph, later, tuple}: PrepareParams) {
    later.planned_send_to(later.namedInput('step_input'), later.namedInput('step_output'));
}

function run(step: Step) {

    const limit = parseInt(step.get('count'));
    let count = 0;

    let limitReached = false;

    function setLimitReached() {
        step.input.setBackpressureStop();
        limitReached = true;
    }

    if (limit === 0) {
        setLimitReached();
        step.output.done();
        return;
    }

    step.input.sendTo({
        receive(data) {
            switch (data.t) {

            case 'done':
                if (!limitReached)
                    step.output.done();
                break;

            case 'item':
                count++;

                if (count > limit)
                    return;

                step.output.receive(data);

                if (count == limit) {
                    step.output.done();
                    setLimitReached();
                }
                break;

            default:
                step.output.receive(data);
            }
        }
    })
}

export const limit = {
    prepare,
    run,
}
