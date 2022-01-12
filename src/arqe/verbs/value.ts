
import { Step } from '../Step'

function run(step: Step) {
    step.output.put(step.queryToItem());
    step.input.sendTo(step.output);
}

export const value = {
    prepare: run,
    run,
}
