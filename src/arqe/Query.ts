
import { parseQuery } from './parser/parseQuery'
import { parseQueryTuple } from './parser/parseQueryTuple'
import { Graph } from './Graph'
import { javascriptQuickMountIntoGraph } from './QuickMount'
import { Item, newItem } from './Item'
import { StringValue, QueryValue, NoValue, TaggedValue } from './TaggedValue'

export type QueryTupleLike = QueryTuple | LooseQueryVerbStep | Function | string;
export type QueryLike = string | Query | LoosePipedQuery | QueryTupleLike | QueryTupleLike[]

export interface QueryTag {
    t: 'tag'
    identifier?: string
    attr?: string
    specialAttr?: { t: 'star' }
    value: TaggedValue
    isOptional?: true
    isFlag?: true
}

export interface QueryTuple {
    t: 'tuple'
    verb: string
    tags: QueryTag[]
}

export interface Query {
    t: 'pipedQuery'
    steps: QueryTuple[]
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
    expectTransform?: boolean
}

export function toQueryTuple(step: QueryTupleLike, ctx: QueryPrepareContext = {}): QueryTuple {
    if (typeof step === 'function') {
        if (!ctx.graph)
            throw new Error("Can't prepare a mounted function without a graph");

        const mount = javascriptQuickMountIntoGraph(ctx.graph, step);

        const tags: QueryTag[] = [];

        for (const [ attrName, attrConfig ] of mount.attrs.entries()) {
            tags.push({
                t: 'tag',
                attr: attrName,
                value: { t: 'no_value' },
            });
        }

        return {
            t: 'tuple',
            verb: 'join',
            tags,
        }

        throw new Error('not handled yet');
    }

    if (typeof step === 'string') {
        const parsed = parseQueryTuple(step, { expectVerb: true });
        if (parsed.t === 'parseError')
            throw new Error("parse error: " + parsed);
        return parsed as QueryTuple;
    }

    if ((step as QueryTuple).t === 'tuple')
        return step as QueryTuple;

    const looseStep = step as LooseQueryVerbStep;
    const tags = [];

    if (!looseStep.attrs)
        throw new Error("step is missing .attrs");

    for (const [ key, value ] of Object.entries(looseStep.attrs)) {
        tags.push({
            t: 'tag',
            attr: key,
            value: value == null ? { t: 'no_value' } : { t: 'str_value', str: value },
        });
    }

    return {
        t: 'tuple',
        verb: looseStep.verb || 'get',
        tags
    };
}

function looseStepsListToQuery(ctx: QueryPrepareContext, steps: QueryTupleLike[]) {
    const query: Query = {
        t: 'pipedQuery',
        steps: steps.map(step => toQueryTuple(step, ctx))
    }

    // validateConvertedQuery(query);

    return query;
}

export function toQuery(queryLike: QueryLike, ctx: QueryPrepareContext = {}): Query {
    if ((queryLike as any).t === 'pipedQuery')
        // Already is a valid Query
        return queryLike as Query;

    if (typeof queryLike === 'string') {
        // Parse string
        const parsed = parseQuery(queryLike, { expectTransform: ctx.expectTransform });

        if (parsed.t === 'parseError') {
            throw new Error("Parse error: " + parsed.message);
        }

        return parsed;
    }

    if ((queryLike as LoosePipedQuery).steps) {
        return looseStepsListToQuery(ctx, (queryLike as LoosePipedQuery).steps);
    }

    if (Array.isArray(queryLike)) {
        return looseStepsListToQuery(ctx, queryLike as QueryTupleLike[]);
    }

    return looseStepsListToQuery(ctx, [queryLike as LooseQueryVerbStep]);
}

export function isQuery(v: any) {
    if (v.t === 'pipedQuery')
        return true;

    return false;
}

export function tagsToItem(tags: QueryTag[]) {
    const item: Item = {};
    for (const tag of tags) {
        switch (tag.value.t) {
            case 'str_value':
                item[tag.attr] = tag.value.str;
                break;
            case 'no_value':
                item[tag.attr] = null;
                break;
            case 'query_value':
                item[tag.attr] = tag.value.query;
                break;
        }
    }

    return item;
}

export function queryTupleToString(tuple: QueryTuple) {
    const out = [tuple.verb];

    for (const tag of tuple.tags) {

        if (tag.specialAttr && tag.specialAttr.t === "star") {
            out.push('*');
            continue;
        }

        let attr = tag.attr;

        if (tag.isFlag)
            attr = '--' + attr;

        switch (tag.value.t) {
        case 'no_value':
            out.push(attr);
            break;
        case 'str_value':
            out.push(`${attr}=${tag.value.str}`);
            break;
        case 'query_value':
            out.push(`${attr}=(${queryToString(tag.value.query)})`);
            break;
        }
    }

    return out.join(' ');
}

export function queryToString(query: Query) {
    return query.steps.map(queryTupleToString).join(' | ');
}

function shallowCopyTag(tag: QueryTag): QueryTag {
    return { ...tag }
}

function shallowCopyTuple(tuple: QueryTuple): QueryTuple {
    return {
        t: tuple.t,
        verb: tuple.verb,
        tags: tuple.tags.concat(),
    }
}

function shallowCopyQuery(query: Query): Query {
    return {
        t: 'pipedQuery',
        steps: query.steps.concat(),
    }
}

export function* rewriteQueryTags(ref: { query: Query }): IterableIterator<[ QueryTag, () => QueryTag ]> {
    
    let copiedQuery = false;

    for (let stepIndex=0; stepIndex < ref.query.steps.length; stepIndex++) {
        let step = ref.query.steps[stepIndex];
        let copiedTuple = false;

        for (let tagIndex=0; tagIndex < step.tags.length; tagIndex++) {
            let tag = step.tags[tagIndex];

            const getWritableTag = (): QueryTag => {
                if (!copiedQuery) {
                    ref.query = shallowCopyQuery(ref.query);
                    copiedQuery = true;
                }

                if (!copiedTuple) {
                    step = shallowCopyTuple(step);
                    ref.query.steps[stepIndex] = step;
                    copiedTuple = true;
                }

                const newTag = shallowCopyTag(tag);
                step.tags[tagIndex] = newTag;
                return newTag;
            }

            yield [ tag, getWritableTag ];
        }
    }
}
