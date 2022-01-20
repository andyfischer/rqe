
import { aggregationVerb } from './_shared'
import { Item, get } from '../Item'
import { Step } from '../Step'

export const order_by = aggregationVerb((items: Item[], step: Step) => {

    function getSortKey(item) {
        const items = [];

        for (const tag of step.tuple.tags)
            items.push(get(item, tag.attr));

        return items.join(' ');
    }

    items.sort((a, b) => {
        return getSortKey(a).localeCompare(getSortKey(b));
    });

    return items;
});
