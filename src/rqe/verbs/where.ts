
import { Step } from '../Step'
import { Item, has, get } from '../Item'
import { PrepareParams } from '../Planning'
import { tagsToItem } from '../Query'

function prepare({graph, later, tuple}: PrepareParams) {
    const args = tagsToItem(tuple.tags);

    later.transform(later.input(), later.output(), (item: Item) => {
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
    prepare,
    runUsingBlock: true,
}
