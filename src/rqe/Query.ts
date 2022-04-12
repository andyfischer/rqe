
import { parseQuery } from './parser/parseQuery'
import { parseQueryTuple } from './parser/parseQueryTuple'
import { Graph, QueryParameters } from './Graph'
import { javascriptQuickMountIntoGraph } from './QuickMount'
import { Item } from './Item'
import { TaggedValue, toTagged, unwrapTagged } from './TaggedValue'
import { mapValues } from './utils/mapObject'

export type QueryStepLike = QueryStep | LooseQueryVerbStep | Function | string;
export type QueryLike = string | Query | LoosePipedQuery | QueryStepLike | QueryStepLike[]

export interface QueryAttr {
    t: 'tag'
    value: TaggedValue
    identifier?: string
    specialAttr?: { t: 'star' }
    isOptional?: true
    isFlag?: true
}

export interface QueryTagEntry {
    attr: string
    tag: QueryAttr
}

export type QueryAttrs = { [attr: string]: QueryAttr }

export interface QueryStep {
    t: 'step'
    verb: string
    attrs: QueryAttrs
}

export interface Query {
    t: 'query'
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
    expectTransform?: boolean
}

export function toQueryTuple(step: QueryStepLike, ctx: QueryPrepareContext = {}): QueryStep {
    if (typeof step === 'function') {
        if (!ctx.graph)
            throw new Error("Can't prepare a mounted function without a graph");

        const mount = javascriptQuickMountIntoGraph(ctx.graph, step);

        const attrs = {};

        for (const [ attrName, attrConfig ] of Object.entries(mount.attrs)) {
            attrs[attrName] = { t: 'tag', value: { t: 'no_value' }};
        }

        return {
            t: 'step',
            verb: 'join',
            attrs,
        }

        throw new Error('not handled yet');
    }

    if (typeof step === 'string') {
        const parsed = parseQueryTuple(step, { expectVerb: true });
        if (parsed.t === 'parseError')
            throw new Error("parse error: " + parsed.message);
        return parsed as QueryStep;
    }

    if ((step as QueryStep).t === 'step')
        return step as QueryStep;

    const looseStep = step as LooseQueryVerbStep;

    if (!looseStep.attrs)
        throw new Error("step is missing .attrs");

    const attrs = {};
    for (const [ key, value ] of Object.entries(looseStep.attrs)) {
        attrs[key] = {
            t: 'tag', 
            value: value == null ? { t: 'no_value' } : { t: 'str_value', str: value }
        };
    }

    return {
        t: 'step',
        verb: looseStep.verb || 'get',
        attrs,
    };
}

function looseStepsListToQuery(ctx: QueryPrepareContext, steps: QueryStepLike[]) {
    const query: Query = {
        t: 'query',
        steps: steps.map(step => toQueryTuple(step, ctx))
    }

    // validateConvertedQuery(query);

    return query;
}

export function toQuery(queryLike: QueryLike, ctx: QueryPrepareContext = {}): Query {
    if ((queryLike as any).t === 'query')
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
        return looseStepsListToQuery(ctx, queryLike as QueryStepLike[]);
    }

    return looseStepsListToQuery(ctx, [queryLike as LooseQueryVerbStep]);
}

export function isQuery(v: any) {
    if (v.t === 'query')
        return true;

    return false;
}

export function attrsToItem(attrs: QueryAttrs) {
    const item: Item = {};
    for (const [ attr, details ] of Object.entries(attrs))
        item[attr] = unwrapTagged(details.value);

    return item;
}

function queryAttrToString(attr: string, details: QueryAttr) {
    if (attr === '*')
        return '*';

    if (details.isFlag)
        attr = '--' + attr;

    switch (details.value.t) {
    case 'no_value':
        return attr;
    case 'abstract':
        return `${attr}=<abstract>`;
    case 'str_value':
        return `${attr}=${details.value.str}`;
    case 'query':
        return `${attr}=(${queryToString(details.value)})`;
    case 'step':
        return `${attr}=(${queryTupleToString(details.value)})`;
    default:
        return `${attr}=${JSON.stringify(unwrapTagged(details.value))}`;
    }
    
    return `(don't know how to stringify: ${JSON.stringify(details)}`
}

export function queryTupleToString(tuple: QueryStep) {
    const out = [];

    for (const [ attr, details ] of Object.entries(tuple.attrs)) {
        out.push(queryAttrToString(attr, details));
    }

    return out.join(' ');
}

export function queryStepToString(step: QueryStep) {
    const out = [step.verb];

    for (const [ attr, details ] of Object.entries(step.attrs)) {
        out.push(queryAttrToString(attr, details));
    }

    return out.join(' ');
}

export function queryToString(query: Query) {
    const steps = [];
    let isFirst = true;
    for (const step of query.steps) {
        if (isFirst)
            steps.push(queryTupleToString(step));
        else
            steps.push(queryStepToString(step));

        isFirst = false;
    }

    return steps.join(' | ');
}

function shallowCopyTuple(tuple: QueryStep): QueryStep {
    return {
        t: tuple.t,
        verb: tuple.verb,
        attrs: { ...tuple.attrs }
    }
}

function shallowCopyQuery(query: Query): Query {
    return {
        t: 'query',
        steps: query.steps.concat(),
    }
}

/*
export function* rewriteQueryTags(ref: { query: Query }): IterableIterator<[ QueryAttr, () => QueryAttr ]> {
    
    let copiedQuery = false;

    for (let stepIndex=0; stepIndex < ref.query.steps.length; stepIndex++) {
        let step = ref.query.steps[stepIndex];
        let copiedTuple = false;

        for (let tagIndex=0; tagIndex < step.tags.length; tagIndex++) {
            let tag = step.tags[tagIndex];

            const getWritableTag = (): QueryAttr => {
                if (!copiedQuery) {
                    ref.query = shallowCopyQuery(ref.query);
                    copiedQuery = true;
                }

                if (!copiedTuple) {
                    step = shallowCopyTuple(step);
                    ref.query.steps[stepIndex] = step;
                    copiedTuple = true;
                }

                const newTag = {...tag};
                step.tags[tagIndex] = newTag;
                return newTag;
            }

            yield [ tag, getWritableTag ];
        }
    }
}

export function queryHasAttr(tuple: QueryStep, attr: string) {
    for (const tag of tuple.tags) 
        if (tag.attr === attr)
            return true;
    return false;
}
*/

export function withoutAttr(tuple: QueryStep, attr: string): QueryStep {
    const attrs = { ...tuple.attrs };
    delete attrs[attr];
    return {
        t: 'step',
        verb: tuple.verb,
        attrs,
    }
}

export function withoutStar(tuple: QueryStep): QueryStep {
    const attrs = { ...tuple.attrs };
    delete attrs['*'];

    return {
        t: 'step',
        verb: tuple.verb,
        attrs,
    }
}

export function withVerb(tuple: QueryStep, verb: string): QueryStep {
    return {
        t: 'step',
        verb,
        attrs: tuple.attrs,
    }
}

export function withAttrs(step: QueryStep, attrs: string[]): QueryStep {
    if (attrs.length === 0)
        return step;

    const added = {};
    for (const attr of attrs) {
        added[attr] = { t: 'tag', value: { t: 'no_value' }};
    }

    return {
        t: 'step',
        verb: step.verb,
        attrs: {
            ...step.attrs,
            ...added,
        }
    };
}

export function tupleHas(tuple: QueryStep, attr: string) {
    return tuple.attrs[attr] !== undefined;
}

export function tupleHasStar(tuple: QueryStep) {
    return tuple.attrs['*'] !== undefined;
}

export function tupleHasValue(tuple: QueryStep, attr: string) {
    const tag = tupleGetTag(tuple, attr);
    return tag && tag.value.t !== 'no_value';
}

export function tupleGetTag(tuple: QueryStep, attr: string): QueryAttr {
    return tuple.attrs[attr];
}

export function tupleGetValue(tuple: QueryStep, attr: string): TaggedValue {
    return tuple.attrs[attr] && tuple.attrs[attr].value;
}

export function tupleGetStringValue(tuple: QueryStep, attr: string) {
    const tval = tupleGetValue(tuple, attr);

    if (!tval || tval.t === 'no_value')
        throw new Error("No value for: " + attr);

    if (tval.t === 'str_value')
        return tval.str;

    throw new Error("Not a string: " + attr);
}

export function addAttrsToQuery(query: Query, values: { [key: string]: any }): Query {
    const lastTuple = query.steps[query.steps.length - 1];

    if (lastTuple.verb !== 'get') {
        throw new Error('addAttrsToQuery only supports verb "get"');
    }

    const added = {};

    for (const [attr,value] of Object.entries(values)) {
        added[attr] = { t: 'tag', value: toTagged(value) };
    }

    return {
        t: 'query',
        steps: [{
            t: 'step',
            verb: 'get',
            attrs: {
                ...lastTuple.attrs,
                ...added,
            }
        }]
    }
}

export function convertQueryToPut(query: Query, values: { [key: string]: any }): Query {
    return addAttrsToQuery(query, {
        ...values,
        'put!': null,
    });
}

export function injectParametersIntoQuery(step: QueryStep, parameters: QueryParameters) {
    return {
        ...step,
        attrs: mapValues(step.attrs, (details, attr) => {

            if (details.value.t === 'step') {
                details = { ...details };
                details.value = injectParametersIntoQuery(details.value, parameters);
            }

            if (details.value.t === 'query') {
                details = { ...details };
                details.value = { ...details.value }
                details.value.steps = details.value.steps.map(step =>
                    injectParametersIntoQuery(step, parameters));
            }

            if (details.identifier && parameters[details.identifier] !== undefined) {
                return {
                    ...details,
                    identifier: null,
                    value: toTagged(parameters[details.identifier]),
                }
            }

            return details;
        }),
    }
}

export function errorOnUnfilledParameters(step: QueryStep) {
    for (const [attr, details] of Object.entries(step.attrs)) {
        if (details.identifier)
            throw new Error(`Missing parameter for $${details.identifier}`);
    }
}
