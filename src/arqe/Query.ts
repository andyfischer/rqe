
import { parseQuery } from './parser/parseQuery'
import { ItemChangeEvent } from './Table'
import { Graph } from './Graph'
import { javascriptQuickMountIntoGraph } from './QuickMount'

export type QueryStepLike = LooseQueryVerbStep | Function;
export type QueryLike = string | Query | LoosePipedQuery | QueryStepLike | QueryStepLike[]

interface Star {
    t: 'star'
}

export interface StringValue {
    t: 'strValue'
    str: string
}

export interface NoValue {
    t: 'noValue'
}

export type QueryTagValue = StringValue | NoValue

export interface QueryTag {
    t: 'queryTag'

    identifier?: string

    attr?: string
    specialAttr?: { t: 'star' }

    value: QueryTagValue

    isOptional?: true
}

export interface QueryStep {
    t: 'queryStep'
    verb: string
    tags: QueryTag[]
}

export interface Query {
    t: 'pipedQuery'
    steps: QueryStep[]
}

export interface LooseQueryVerbStep {
    verb?: string
    attrs: { [key: string]: any }
}


export interface LoosePipedQuery {
    steps: LooseQueryVerbStep[]
}

interface QueryPrepareContext {
    graph?: Graph
}

export function prepareLooseQueryStep(ctx: QueryPrepareContext, step: QueryStepLike): QueryStep {
    if (typeof step === 'function') {
        if (!ctx.graph)
            throw new Error("Can't prepare a mounted function without a graph");

        const mount = javascriptQuickMountIntoGraph(ctx.graph, step);

        const tags: QueryTag[] = [];

        for (const [ attrName, attrConfig ] of mount.attrs.entries()) {
            tags.push({
                t: 'queryTag',
                attr: attrName,
                value: { t: 'noValue' },
            });
        }

        return {
            t: 'queryStep',
            verb: 'join',
            tags,
        }

        throw new Error('not handled yet');
    }

    const tags = [];

    if (!step.attrs)
        throw new Error("step is missing .attrs");

    for (const [ key, value ] of Object.entries(step.attrs)) {
        tags.push({
            t: 'queryTag',
            attr: key,
            value: value == null ? { t: 'noValue' } : { t: 'strValue', str: value },
        });
    }

    return {
        t: 'queryStep',
        verb: step.verb || 'get',
        tags
    };
}

function looseStepsListToQuery(ctx: QueryPrepareContext, steps: QueryStepLike[]) {
    const query: Query = {
        t: 'pipedQuery',
        steps: steps.map(step => prepareLooseQueryStep(ctx, step))
    }

    validateConvertedQuery(query);

    return query;
}

function validateConvertedQuery(query: Query) {
    if (query.steps.length === 0)
        throw new Error("query has empty .steps list");

    if (query.steps[0].verb !== 'get')
        throw new Error("expected first query step to be 'get'");
}


export function toQuery(queryLike: QueryLike, ctx: QueryPrepareContext = {}): Query {
    if ((queryLike as any).t === 'pipedQuery')
        // Already is a valid Query
        return queryLike as Query;

    if (typeof queryLike === 'string') {
        // Parse string
        const parsed = parseQuery(queryLike);

        if (parsed.t === 'parseError') {
            throw new Error("Parse error: " + parsed.message);
        }

        return parsed;
    }

    if ((queryLike as LoosePipedQuery).steps) {
        return looseStepsListToQuery(ctx, (queryLike as LoosePipedQuery).steps);
    }

    if (Array.isArray(queryLike)) {
        return looseStepsListToQuery(ctx, queryLike as QueryStepLike[]);
    }

    return looseStepsListToQuery(ctx, [queryLike as LooseQueryVerbStep]);
}
