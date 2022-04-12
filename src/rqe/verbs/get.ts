

import { Step } from '../Step'

function run(step: Step) {
    return step.runTableSearch(step.tuple, step.input, step.output);
}

export const get = {
    run
}
