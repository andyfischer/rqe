
import { Step } from '../Step'

function run(step: Step) {
    const { input, output } = step;

    input.aggregate(output, items => {
        return items.reverse();
    });
}

export const reverse = {
    run,
};
