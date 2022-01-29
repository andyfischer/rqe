
import { Query } from './Query'
import { Item } from './Item'

export interface StringValue {
    t: 'str_value'
    str: string
}

export interface QueryValue {
    t: 'query_value'
    query: Query
}

export interface NoValue {
    t: 'no_value'
}

export interface ItemValue {
    t: 'item'
    item: Item
}

export interface AbstractValue {
    t: 'abstract'
}

export type TaggedValue = StringValue | QueryValue | ItemValue | NoValue | AbstractValue

export function unwrapTagged(tval: TaggedValue) {
    switch (tval.t) {
    case 'str_value':
        return tval.str;
    case 'no_value':
        return null;
    case 'query_value':
        return tval.query;
    case 'item':
        return tval.item;
    case 'abstract':
        throw new Error(`can't unwrap an abstract value`);
    default:
        throw new Error('unhandled case in unwrapTagged: ' + (tval as any).t);
    }
}
