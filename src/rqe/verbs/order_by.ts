
import { Item, get } from '../Item'
import { Step } from '../Step'
import { PrepareParams } from '../Planning'

function prepare({graph, later, tuple}: PrepareParams) {
    function getSortKey(item) {
        const items = [];

        for (const tag of tuple.tags)
            items.push(get(item, tag.attr));

        return items.join(' ');
    }

    later.aggregate(later.input(), later.output(), (items: Item[]) => {
        // console.log('called order_by aggregate with', items);
        items.sort((a, b) => {
            return getSortKey(a).localeCompare(getSortKey(b));
        });

        return items;
    });
}

export const order_by = {
    prepare,
    runUsingBlock: true,
}
