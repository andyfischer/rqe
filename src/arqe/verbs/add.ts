
import { Stream } from '../Stream'
import { Step } from '../Step'
import { prepareTableSearch } from '../PlannedQuery'
import { shallowCopy } from '../Item'
import { QueryTag, tagsToItem } from '../Query'
import { Block } from '../Block'

function prepare(step: Step, later: Block) {
    for (const it of step.input)
        step.put(it);

    step.put(tagsToItem(step.tags));

    const mainStep = later.namedInput('step');

    const receivers = later.join_streams(2, later.step_output(mainStep));
    const inputReceiver = later.get_index(receivers, 0);
    later.send_to(later.step_input(mainStep), inputReceiver);

    const searchReceiver = later.get_index(receivers, 1);

    let updatedStep = mainStep;
    updatedStep = later.step_with_verb(updatedStep, 'get');
    updatedStep = later.step_with_input(updatedStep, later.new_stream());
    updatedStep = later.step_with_output(updatedStep, searchReceiver);
    prepareTableSearch(step.graph, step, updatedStep, later);
}

export const add = {
    prepare,
    runUsingBlock: true,
}
