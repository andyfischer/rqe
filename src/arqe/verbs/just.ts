
import { Step } from '../Step'
import { TransformFunc, transformAsVerb } from './_shared'
import { Item, has, get, entries } from '../Item'

const run: TransformFunc<Item> = (item: Item, args: Item) => {
    const out = {};

    for (const [key,value] of entries(item)) {
        if (has(args, key))
            out[key] = value;
    }

    return [out];
};

export const just = transformAsVerb<Item>(run, (step: Step) => {
    return step.queryToItem();
});
