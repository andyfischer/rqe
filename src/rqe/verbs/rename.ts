
import { Graph } from '../Graph'
import { Step } from '../Step'
import { Item, has, get } from '../Item'
import { PrepareParams } from '../Planning'
import { tagsToItem } from '../Query'

interface Args {
    from: string
    to: string
}

function prepare({graph, later, tuple}: PrepareParams) {

    const args = tagsToItem(tuple.tags);

    later.transform(later.input(), later.output(), (item: Item) => {
        if (has(item, args.from)) {
            const val = get(item, args.from);

            const updated = {
                ...item,
            }

            delete updated[args.from];
            updated[args.to] = val;

            return [updated];

        } else {
            return [item];
        }
    });
};

export const rename = {
    prepare,
    runUsingBlock: true,
};

