
import { Step } from '../Step'
import { prepareTableSearch } from '../PlannedQuery'
import { QueryTag, tagsToItem } from '../Query'
import { Block, executeBlock } from '../Block'

function prepare(step: Step, block: Block) {
    for (const it of step.input)
        step.put(it);

    step.put(tagsToItem(step.tags));

    prepareTableSearch(step, block.namedInput('step'), block);
}

export const get = {
    prepare,
    runUsingBlock: true,
}
