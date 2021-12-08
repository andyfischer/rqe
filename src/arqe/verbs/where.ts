
import Params from '../Params'
import { TransformFunc, transformAsVerb } from './_shared'
import { Item, has, get } from '../Item'

type Args = any;

function where(item: Item, args: any): Item[] {

    for (const [ key, value ] of Object.entries(args)) {

        if (!has(item, key))
            return [];

        if (value != null && value != get(item, key))
            return [];
    }

    return [item];
}

const whereVerb = transformAsVerb<Args>(where, params => params.queryToItem());

export default whereVerb;
