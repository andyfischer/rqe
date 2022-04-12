
import { Step } from '../Step'
import { Item, has, entries } from '../Item'

function run(step: Step) {
    const { tuple, input, output } = step;
    const args = step.queryToItem();

    input.transform(output, (item: Item) => {
        const out = {};

        for (const [key, value] of entries(item)) {
            if (has(args, key))
                out[key] = value;
        }

        return [out];
    });
}

export const just = {
    run,
}
