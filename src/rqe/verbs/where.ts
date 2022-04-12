
import { Step } from '../Step'
import { Item, has, get } from '../Item'

function run(step: Step) {

    const { input, output, tuple } = step;
    const args = step.queryToItem();

    input.transform(output, (item: Item) => {
        for (const [key, value] of Object.entries(args)) {
            if (!has(item, key))
                return [];

            const itemValue = get(item, key);

            if (itemValue == null)
                return [];

            if (value != null && value != itemValue)
                return [];
        }

        return [item];
    });
}

export const where = {
    run,
}
