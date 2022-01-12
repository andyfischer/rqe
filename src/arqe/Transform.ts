
import { Item } from './Item'
import { TransformDefs } from './transforms/_list'
import { Step } from './Step'
import { Graph } from './Graph'
import { javascriptQuickMountIntoGraph } from './QuickMount'
import { Scope } from './Scope'
import { Stream } from './Stream'
import { Query, QueryLike, toQuery } from './Query'
import { runQuery } from './RunningQuery'

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

                throw new Error('todo: handle function');
            }

            throw new Error('unhandled step in toTransformQuery: ' + looseStep);
        })
    }
}

export function applyTransform(graph: Graph, items: Item[], query: Query): Stream {

    if (query.steps.length > 0 && !query.steps[0].verb) {
        throw new Error('applyTransform expected a transform query');
    }

    const scope = new Scope(graph);
    const inputAsStream = new Stream();

    const output = runQuery(null, query, inputAsStream);

    for (const item of items) {
        inputAsStream.put(item);
    }
    inputAsStream.done();

    return output;
}

export function applyTransformationToGraph(graph: Graph, transformLike: QueryLike) {

    const transform = toQuery(transformLike);
    const accessStep = transform.steps[0];

    // Run the query.
    const results = graph.query(transform).sync();

    if (results.hasError()) {
        throw results.errorsToException();
    }

    const matches = graph.getQueryMountMatches(accessStep);

    // Delete the current contents.
    const deleteStep = {
        ...accessStep,
        tags: accessStep.tags.concat({ t: 'tag', attr: 'delete!', value: { t: 'no_value' } }),
    };

    graph.query(deleteStep);

    // Put the results as the new contents.
    for (const item of results) {
        const putStep = {
            attrs: {
                ...item,
                'put!': null,
            }
        }
        graph.query(putStep);
    }
}
