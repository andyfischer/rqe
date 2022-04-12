
import { Step } from '../Step'
import { Item, get } from '../Item'

class ItemKeyer {
    attrs: string[]

    constructor(attrs: string[]) {
        this.attrs = attrs;
    }

    getKey(item: Item) {
        const out: string[] = [];

        for (const attr of this.attrs)
            out.push(get(item, attr));

        return JSON.stringify(out);
    }
}

function run(step: Step) {
    const { input, output } = step;

    const keyer = new ItemKeyer(Array.from(Object.keys(step.queryToItem())));

    input.aggregate(output, (items) => {

        const counts = new Map<string,number>();

        for (const item of items) {
            const key = keyer.getKey(item);
            if (!counts.has(key))
                counts.set(key, 1);
            else
                counts.set(key, counts.get(key) + 1);
        }

        const result = []
        for (const [ key, count ] of counts) {
            const items = JSON.parse(key);

            const out = {};

            for (let i=0; i < keyer.attrs.length; i++) {
                const attr = keyer.attrs[i];
                out[attr] = items[i];
            }

            out['count'] = count;

            result.push(out);
        }

        return result;
    });
}

export const count_by = {
    run,
}
