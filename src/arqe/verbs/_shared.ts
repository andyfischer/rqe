
import Params from '../Params'
import { Item } from '../Item'

export type TransformFunc<Args> = (item: Item, args: Args) => Item[]
export type GetArgsFunc<Args> = (params: Params) => Args

export function transformAsVerb<Args>(func: TransformFunc<Args>, getArgs: GetArgsFunc<Args>) {

    return (params) => {
        const args = getArgs(params);
        params.input.sendTo({
            receive: (data) => {
                switch (data.t) {

                case 'done':
                    params.output.done();
                    break;

                case 'item':
                    for (const transformed of func(data.item, args)) {
                        params.output.put(transformed);
                    }

                    break;

                default:
                    params.output.receive(data);
                }
            }
        });
    }
}
