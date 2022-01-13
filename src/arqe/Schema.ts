
import { Table } from './Table'
import { Setup } from './Setup'
import { Graph } from './Graph'
import { Item } from './Item'
import { parseQueryTupleWithErrorCheck } from './parser'

export interface IndexConfiguration {
    attrs: string[]
    unique?: boolean | UniqueConstraintConfig
}

export type IndexConfig = string | IndexConfiguration

export interface Reference {
    attr: string
    table?: Table
    foreignAttr?: string
    onDelete: OnDeleteOption
}

export interface UniqueConstraintConfig {
    onConflict: OnConflictOption
}

export type OnConflictOption = 'overwrite' | 'error' | 'ignore'
export type OnDeleteOption = 'cascade' | 'set_null'
export type AttrGenerationMethod = 'increment' | 'random' | 'time_put'

export interface LooseAttrConfig {
    index?: boolean
    required?: boolean
    reference?: {
        onDelete: OnDeleteOption
    }
    foreignKey?: {
        table: Table
        foreignAttr: string
        onDelete?: OnDeleteOption
    }
    unique?: boolean | UniqueConstraintConfig
    generate?: {
        prefix?: string
        length?: number
        method: AttrGenerationMethod
    }
}

export interface AttrConfig {
    index?: boolean
    required?: boolean
    reference?: {
        onDelete: OnDeleteOption
    }
    foreignKey?: {
        table: Table
        foreignAttr: string
        onDelete?: OnDeleteOption
    }
    unique?: UniqueConstraintConfig
    generate?: {
        prefix?: string
        length?: number
        method: AttrGenerationMethod
    }
}

export type MountSpec = true | NamespaceMount | MountCustomizeFn
export type MountCustomizeFn = (setup: Setup) => Setup

export interface NamespaceMount {
    namespace: string
}

export interface TableSchema {
    name?: string
    attrs?: { [attr: string]: AttrConfig }
    indexes?: IndexConfig[]
    references?: Reference[]
    foreignKeys?: Reference[]
    initialItems?: Item[]

    hint?: 'inmemory'
    mount?: MountSpec
    funcs?: string[]
}

export interface LooseTableSchema {
    name?: string
    attrs?: string | { [attr: string]: LooseAttrConfig }
    indexes?: IndexConfig[]
    references?: Reference[]
    foreignKeys?: Reference[]
    initialItems?: Item[]

    hint?: 'inmemory'
    mount?: MountSpec
    funcs?: string[]
}

export function setupWithMountSpec(spec: MountSpec, setup: Setup): Setup {
    if (!spec) 
        return setup;

    if (spec === true)
        throw new Error("don't need spec=true");

    if (typeof spec === 'function')
        return spec(setup);

    if (spec.namespace) {
        return setup.table({ attrs: { [spec.namespace]: { required: true } }});
    }

    throw new Error("unhandled spec: " + spec)
}

export function findUniqueAttr(schema: TableSchema): [ string, AttrConfig ] | [] {
    for (const [attr, attrConfig] of Object.entries(schema.attrs)) {
        if (attrConfig.unique) {
            return [ attr, attrConfig ];
        }
    }

    return [];
}

export function fixLooseSchema(schema: LooseTableSchema): TableSchema {

    let attrs: { [key: string]: LooseAttrConfig };

    if (typeof schema.attrs === 'string') {
        attrs = {};
        for (const tag of parseQueryTupleWithErrorCheck(schema.attrs, { expectVerb: false }).tags) {
            attrs[tag.attr] = {};
        }
    } else {
        attrs = schema.attrs || {};
    }

    for (const [attr, attrConfig] of Object.entries(attrs)) {

        const fixedConfig = {
            ...attrConfig
        }

        if (fixedConfig.unique === false)
            delete fixedConfig.unique;

        if (fixedConfig.unique === true)
            fixedConfig.unique = { onConflict: 'error' }

        if (fixedConfig.generate) {
            if (!fixedConfig.unique) 
                fixedConfig.unique = { onConflict: 'error' };

            fixedConfig.index = true;
        }
        
        if (fixedConfig.unique) {
            fixedConfig.index = true;
        }

        attrs[attr] = fixedConfig;
    }

    return {
        ...schema,
        attrs,
    } as TableSchema;
}
