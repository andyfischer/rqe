
import { Item } from './Item'
import { TransformDefs } from './transforms/_list'
import Params from './Params'
import { Graph } from './Graph'
import { javascriptQuickMountIntoGraph } from './QuickMount'
import { runPipedQuery } from './runQuery'
import { Scope } from './Scope'
import { Stream } from './Stream'
import { Query } from './Query'

export type TransformFunc = (input: Item, args: any) => Item[]
export interface TransformDef {
    func: TransformFunc
}

export type LooseTransformQuery = TransformQuery | LooseTransformStep[]
export type LooseTransformStep = VerbTransformStep | Function

export type TransformStep = VerbTransformStep

export interface VerbTransformStep {
    verb: 'rename' | 'where'
    [key: string]: any
}

export type TransformQuery = {
    t: 'transform',
    steps: TransformStep[]
}

export function toTransformQuery(graph: Graph | null, looseQuery: TransformQuery | LooseTransformQuery): TransformQuery {
    if ((looseQuery as TransformQuery).t === 'transform')
        return looseQuery as TransformQuery;

    looseQuery = looseQuery as LooseTransformStep[];

    return {
        t: 'transform',
        steps: looseQuery.map((looseStep: LooseTransformStep) => {
            if ((looseStep as VerbTransformStep).verb)
                return looseStep as VerbTransformStep;

            if (typeof looseStep === 'function') {
                if (!graph) {
                    throw new Error("Can't mount a raw function without a valid graph");
                }

                const mount = javascriptQuickMountIntoGraph(graph, looseStep);

                console.log('mounted:', mount);

                throw new Error('todo: handle function');
            }

            throw new Error('unhandled step in toTransformQuery: ' + looseStep);
        })
    }
}

/*
export function applyTransform(query: TransformQuery, items: Item[]) {

    let out = [];

    let fromLastStep = items;
    let toNextStep = [];
    for (const step of query.steps) {
        const verb = step.verb;
        const stepDef = TransformDefs[verb];

        for (const item of fromLastStep) {
            const results = stepDef.func(item, step);
            toNextStep = toNextStep.concat(results);
        }

        fromLastStep = toNextStep;
        toNextStep = [];
    }

    return fromLastStep;
}
*/

export function applyTransform(graph: Graph, items: Item[], query: Query): Item[] {

    const scope = new Scope(graph);
    const inputAsStream = new Stream();

    const output = runPipedQuery(scope, query, inputAsStream);

    for (const item of items) {
        inputAsStream.put(item);
    }
    inputAsStream.done();

    if (!output.isDone())
        throw new Error("query didn't finish synchronously");
    return output.takeBacklogItems();
}
