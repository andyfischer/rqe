
import { Query, QueryStep, queryStepToString, queryToString } from './Query'
import { Item } from './Item'
import { formatItem } from './format/formatItem'
import { pointSpecToString, MountPointSpec } from './MountPoint'

export interface StringValue {
    t: 'str_value'
    str: string
}

export interface ObjectValue {
    t: 'obj_value'
    val: any
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

export type TaggedValue = StringValue | ItemValue | NoValue | AbstractValue | ObjectValue | QueryStep | Query | MountPointSpec

export function toTagged(val: any): TaggedValue {
    if (val === null) {
        return {
            t: 'no_value',
        }
    }

    switch (val.t) {
    case 'query':
        return val;
    }

    switch (typeof val) {
    case 'string':
        return {
            t: 'str_value',
            str: val,
        }
    case 'number':
        return {
            t: 'str_value',
            str: val + '',
        }
    }

    return {
        t: 'obj_value',
        val,
    }

    throw new Error("unsupported type in toTagged: " + val);
}

export function unwrapTagged(tval: TaggedValue) {
    switch (tval.t) {
    case 'str_value':
        return tval.str;
    case 'no_value':
        return null;
    case 'query':
    case 'step':
        return tval;
    case 'item':
        return tval.item;
    case 'obj_value':
        return tval.val;
    case 'abstract':
        throw new Error(`can't unwrap an abstract value`);
    default:
        throw new Error('unhandled case in unwrapTagged: ' + (tval as any).t);
    }
}

export function taggedToString(tval: TaggedValue) {
    switch (tval.t) {
    case 'str_value':
        return tval.str;
    case 'no_value':
        return '<no_value>';
    case 'query':
        return '(' + queryToString(tval) + ')';
    case 'step':
        return '(' + queryStepToString(tval) + ')';
    case 'item':
        return formatItem(tval.item);
    case 'obj_value':
        return tval.val;
    case 'mountPointSpec':
        return pointSpecToString(tval);
    case 'abstract':
        return '<abstract>';
    default:
        throw new Error('unknown type in taggedToString: ' + (tval as any).t);
    }
}

export function tvalEquals(left: TaggedValue, right: TaggedValue) {
    if (left.t !== right.t)
        return false;

    switch (left.t) {
    case 'item':
    case 'step':
    case 'obj_value':
        console.warn('warning- tvalEquals not fully implemented for objects');
    }

    return unwrapTagged(left) === unwrapTagged(right);
}
