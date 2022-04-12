
import { get } from '../Item'
import { Step } from '../Step'

function run(step: Step) {
    const { tuple, input, output } = step;

    function getSortKey(item) {
        const items = [];

        for (const attr of Object.keys(tuple.attrs))
            items.push(get(item, attr));

        return items.join(' ');
    }

    input.aggregate(output, (items) => {
        // console.log('called order_by aggregate with', items);
        items.sort((a, b) => {
            return getSortKey(a).localeCompare(getSortKey(b));
        });

        return items;
    });
}

export const order_by = {
    run,
}
