
import { Step } from '../Step'
import { Item } from '../Item'
import { c_done, c_item } from '../Enums'
import { Stream } from '../Stream'
import { Block } from '../Block'

export type TransformFunc<Args> = (item: Item, args: Args) => Item[]
export type GetArgsFunc<Args> = (step: Step) => Args
export type AggregationFunc = (items: Item[], step: Step) => Item[]

export interface Verb {
    prepare?: (step: Step, block: Block) => void
    run?: (step: Step) => void
    runUsingBlock?: boolean
}

export function transformAsVerb<Args>(func: TransformFunc<Args>, getArgs: GetArgsFunc<Args>): Verb {

    function run(step: Step) {
        const args = getArgs(step);
        step.input.sendTo({
            receive: (data) => {
                switch (data.t) {

                case c_done:
                    step.output.done();
                    break;

                case c_item:
                    for (const transformed of func(data.item, args)) {
                        step.output.put(transformed);
                    }

                    break;

                default:
                    step.output.receive(data);
                }
            }
        });
    }

    return {
        prepare: run,
        run,
    }
}


export function aggregationVerb(func: AggregationFunc): Verb {
    function run(step: Step) {
        let items = [];
        step.input.sendTo({
            receive(data) {
                switch (data.t) {

                case 'done':
                    const result = func(items, step);
                    items = [];
                    for (const item of result) {
                        step.output.put(item);
                    }
                    step.output.done();
                    break;

                case 'item':
                    items.push(data.item);
                    break;

                default:
                    step.output.receive(data);
                }
            }
        })
    }

    return {
        prepare: run,
        run,
    }
}

