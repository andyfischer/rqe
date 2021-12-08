
import Params from '../Params'
import { TransformFunc, transformAsVerb } from './_shared'
import { Item, has, get } from '../Item'

interface Args {
    from: string
    to: string
}

const rename: TransformFunc<Args> = (item: Item, args: Args) => {
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
};

const renameVerb = transformAsVerb<Args>(rename, (params: Params) => {
    const args = params.queryToItem();
    return { from: args.from, to: args.to };
});

export default renameVerb;
