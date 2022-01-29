
import { Step } from '../Step'
import { Item, has, get, entries } from '../Item'
import { tagsToItem } from '../Query'
import { PrepareParams } from '../Planning'

function prepare({graph, later, tuple}: PrepareParams) {
    const args = tagsToItem(tuple.tags);

    later.transform(later.input(), later.output(), (item: Item) => {
        const out = {};

        for (const [key,value] of entries(item)) {
            if (has(args, key))
                out[key] = value;
        }

        return [out];
    });
};

export const just = {
    prepare,
    runUsingBlock: true,
}
