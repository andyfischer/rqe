
import { MemoryTable } from './MemoryTable'
import { Setup } from './Setup'
import { Graph } from './Graph'

export interface IndexConfigurationObject {
    attrs: string[]
    unique?: boolean | UniqueConstraintConfig
}

export type IndexConfig = string | IndexConfigurationObject

export interface Reference {
    attr: string
    table?: MemoryTable
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
        table: MemoryTable
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
        table: MemoryTable
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

    hint?: 'inmemory'
    mount?: MountSpec
}

export interface LooseTableSchema {
    name?: string
    attrs?: { [attr: string]: LooseAttrConfig }
    indexes?: IndexConfig[]
    references?: Reference[]
    foreignKeys?: Reference[]

    hint?: 'inmemory'
    mount?: MountSpec
}

export function setupWithMountSpec(spec: MountSpec, setup: Setup): Setup {
    if (spec === true) {
        return setup;
    }

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

    schema.attrs = schema.attrs || {};
    for (const attrConfig of Object.values(schema.attrs)) {

        if (attrConfig.unique === false)
            delete attrConfig.unique;

        if (attrConfig.unique === true)
            attrConfig.unique = { onConflict: 'error' }

        if (attrConfig.generate) {
            if (!attrConfig.unique) 
                attrConfig.unique = { onConflict: 'error' };

            attrConfig.index = true;
        }
        
        if (attrConfig.unique) {
            attrConfig.index = true;
        }
    }

    return schema as TableSchema;
}
