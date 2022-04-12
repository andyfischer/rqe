
import { Step } from '../Step'

function run(step: Step) {
    const { tuple, output } = step;
    const args = step.queryToItem();

    output.put(args);
    output.done();
}

export const value = {
    run,
}
