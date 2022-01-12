
import { Step } from '../Step'
import { Stream } from '../Stream'

function prepare(step: Step) {
}

function run(step: Step) {
    const duration = parseInt(step.get('duration'), 10);

    setTimeout(() => {
        step.input.sendTo(step.output);
    }, duration);
}

export const wait = {
    prepare,
    run,
}
