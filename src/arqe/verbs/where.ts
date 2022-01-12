
import { Step } from '../Step'
import { TransformFunc, transformAsVerb } from './_shared'
import { Item, has, get } from '../Item'

type Args = any;

function run(item: Item, args: any): Item[] {

    for (const [ key, value ] of Object.entries(args)) {

        if (!has(item, key))
            return [];

        if (value != null && value != get(item, key))
            return [];
    }

    return [item];
}

export const where = transformAsVerb<Args>(run, params => params.queryToItem());
