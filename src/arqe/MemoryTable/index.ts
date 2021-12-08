
import { randomHex } from '../utils'
import { TableSchema, OnDeleteOption, OnConflictOption, Reference,
    AttrGenerationMethod } from '../Schema'
import { Graph } from '../Graph'
import { Table, ItemChangeListener } from '../Table'
import { fixLooseSchema, findUniqueAttr, LooseTableSchema, IndexConfigurationObject } from '../Schema'
import TableIndex from './TableIndex'
import { IDSourceNumber as IDSource } from '../utils/IDSource'
import { formatItem } from '../formatToString'
import { assert } from '../utils/assert'
import { platformExtendClass } from './platform'
import { PipeError, PipeWarning } from '../Stream'
import { Table as TableInterface } from '../Table'
import { MemoryTableExtraErrorMessages } from '../config'

const ConfigFrequentValidation = true;

interface ObjectHeader {
    table: MemoryTable
    tableInternalKey: number
    globalId?: string
    referencers?: Map<string, RowReference>
}

interface RowReference {
    value: any
    attr: string
    onDelete: OnDeleteOption
}

function initRowInfo(object: any, rowinfo: ObjectHeader) {
    // by using defineProperty, this 'secret' property won't show up in Object.keys() or JSON.stringify()
    Object.defineProperty(object, 'rowinfo', { value: 'static', writable: true });
    object.rowinfo = rowinfo;
}

function withoutHeader(object: any) {
    return {
        ...object,
    }
}

function clearHeader(object: any) {
    object.rowinfo = {} as any;
}

export function header(object: any): ObjectHeader {
    return object.rowinfo;
}

function* iteratorMap<I,O>(it: Iterable<I>, callback: (val: I) => O) {
    for (const item of it)
        return callback(item);
}

type ConstraintType = 'unique'
export type AttrMap = Map<string, any>;
export type AttrSet = Map<string, true>;
export type LooseAttrList = string | string[]
type AttrType = ReferenceType

interface UniquenessConstraint<ValueType> {
    constraintType: 'unique'
    onConflict: OnConflictOption
    index: TableIndex<ValueType>
}

interface RequiredAttrConstraint {
    constraintType: 'required_attr'
    attr: string
}

type Constraint<ValueType> = UniquenessConstraint<ValueType> | RequiredAttrConstraint

interface GeneratedValue {
    attr: string
    prefix: string
    method: AttrGenerationMethod
    length: number
    nextId: number
}

interface ReferenceType {
    table: MemoryTable
}

interface Filter {
    conditions: WhereCondition[]
}

interface WhereCondition {
    attr: string
    value: any
}

export function itemGlobalId(header: ObjectHeader) {
    if (header.globalId)
        return header.globalId;

    const globalId = header.table.name() + '/' + header.tableInternalKey;
    header.globalId = globalId;
    return globalId;
}

function parseAttrList(attrSet: LooseAttrList): Map<string, true> {
    const map = new Map<string, true>();
    if (Array.isArray(attrSet))
        for (const attr of attrSet)
            map.set(attr, true);
    else
        map.set(attrSet, true);

    return map;
}

function toArray(looseList: string | string[]): string[] {
    if (typeof looseList === 'string')
        return [looseList];
    return looseList;

}

function attrSetsEqual(a: AttrSet, b: AttrSet) {
    if (a.size !== b.size)
        return false;

    for (const key of Object.keys(a))
        if (!b.get(key))
            return false;

    return true;
}

function parseWhereFilter(input: any): Filter {
    const out: Filter = {
        conditions: []
    }

    for (const k in input) {
        out.conditions.push({
            attr: k,
            value: input[k]
        });
    }

    return out;
}

function objectToMap(obj: any) {
    const map = new Map<string, any>()
    for (const k in obj) {
        if (k === 'rowinfo')
            continue;
        map.set(k, obj[k]);
    }
    return map;
}

function listToMap(list: string[]) {
    const map = new Map<string, true>()
    for (const item of list)
        map.set(item, true);
    return map;
}

interface SetupOptions {
    name?: string
    graph?: Graph
}

export class MemoryTable<ValueType = any> implements TableInterface {

    _name: string
    graph: Graph
    tableId: string

    nextInternalID = new IDSource()

    items = new Map<number, ValueType>()
    _warnings: PipeWarning[] = []
    _errors: PipeError[] = []
    constraints: Constraint<ValueType>[] = []
    generatedValues: GeneratedValue[] = []
    _schema: TableSchema
    indexes: TableIndex<ValueType>[] = []
    indexesBySingleAttr = new Map<string, TableIndex<ValueType>>()
    references: Reference[] = []
    itemChangeListeners?: ItemChangeListener[]
    primaryUniqueAttr?: string

    constructor(looseSchema: LooseTableSchema, setupOptions: SetupOptions = {}) {
        const schema = fixLooseSchema(looseSchema);

        this._name = (setupOptions && setupOptions.name) || schema.name;
        this.graph = (setupOptions && setupOptions.graph);
        this._schema = schema;

        if (this.graph)
            this.tableId = this.graph.nextTableId.take();

        for (const [attr, attrConfig] of Object.entries(schema.attrs || {})) {
            if (attrConfig.index) {
                this._newIndex({ attrs: [attr] });
            }

            if (attrConfig.unique) {
                this.addUniqueConstraint([attr], attrConfig.unique.onConflict);
            }

            if (attrConfig.required) {
                this.constraints.push({
                    constraintType: 'required_attr',
                    attr,
                });
            }

            if (attrConfig.reference) {
                this.addReference(attr, attrConfig.reference.onDelete);
            }

            if (attrConfig.foreignKey) {
                this.addForeignKey(attr, attrConfig.foreignKey.table,
                                   attrConfig.foreignKey.foreignAttr,
                                   attrConfig.foreignKey.onDelete || 'set_null'
                                  );
            }

            if (attrConfig.generate) {
                this.generatedValues.push({
                    attr,
                    prefix: attrConfig.generate.prefix || '',
                    method: attrConfig.generate.method || 'random',
                    length: attrConfig.generate.length || 6,
                    nextId: 1
                });
            }
        }

        for (const indexConfig of (schema.indexes || [])) {
            if (typeof indexConfig === 'string')
                this._newIndex({ attrs: [indexConfig] });
            else
                this._newIndex(indexConfig);
        }

        for (const referenceConfig of schema.references || []) {
            this.references.push(referenceConfig);
        }

        for (const foreignKeyConfig of schema.foreignKeys || []) {
            this.references.push(foreignKeyConfig);
        }

        const [ primaryUniqueAttr, _] = findUniqueAttr(schema);
        this.primaryUniqueAttr = primaryUniqueAttr;
    }

    getEffectiveAttrs(): string[] {
        const attrs = {};
        for (const item of this.scan()) {
            for (const key of Object.keys(item))
                attrs[key] = true;
        }
        return Object.keys(attrs);
    }

    _newIndex(config: IndexConfigurationObject) {
        const index = new TableIndex<ValueType>(this, config.attrs);
        this.indexes.push(index);

        if (index.attrs.length === 1)
            this.indexesBySingleAttr.set(index.attrs[0], index);

        if (config.unique) {
            const onConflict: OnConflictOption = config.unique === true ? 'error' : config.unique.onConflict;
            this.constraints.push({
                constraintType: 'unique',
                onConflict,
                index,
            });
        }

        return index;
    }

    schema() {
        return this._schema;
    }

    name() {
        return this._name;
    }

    count() {
        return this.items.size;
    }

    itemToKey(item: ValueType) {
        if (this.primaryUniqueAttr) {
            return { [this.primaryUniqueAttr]: item[this.primaryUniqueAttr] }
        }

        console.error(`can't run itemToKey: `, item);
        throw this.usageError('unsupported: itemToKey needs a primaryUniqueAttr');
    }

    findIndex(attrSet: AttrSet) {
        for (const index of this.indexes) {
            if (attrSetsEqual(attrSet, index.attrSet))
                return index;
        }
        return null;
    }

    addUniqueConstraint(attrs: LooseAttrList, onConflict: OnConflictOption = 'error') {
        if (this.items.size > 0)
            throw new Error("unsupported: can't add constraint after rows are added");

        const attrSet = parseAttrList(attrs);
        let index = this._addIndex(attrs);

        this.constraints.push({
            constraintType: 'unique',
            onConflict,
            index,
        });

        return this;
    }

    addReference(attr: string, onDelete: OnDeleteOption) {
        this.references.push({ attr, onDelete });
        return this;
    }

    addForeignKey(attr: string, table: MemoryTable, foreignAttr: string, onDelete: OnDeleteOption) {
        if (!table.hasIndexForAttrs([foreignAttr])) {
            throw this.usageError(`can't addForeignKey, no index for: ${foreignAttr}`);
        }

        this.references.push({ attr, table, foreignAttr, onDelete });
        return this;
    }

    _addIndex(attrs: LooseAttrList) {
        const attrSet = parseAttrList(attrs);
        const existing = this.findIndex(attrSet);
        if (existing)
            return existing;

        return this._newIndex({ attrs: toArray(attrs) });
    }

    addIndex(attrs: LooseAttrList) {
        this._addIndex(attrs);
        return this;
    }

    hasIndexForAttrs(attrs: string[]) {
        const attrsMap = listToMap(attrs);
        for (const index of this.indexes) {
            if (index.coversAttrs(attrsMap)) {
                return true;
            }
        }
        return false;
    }

    _beforePut(item: ValueType) {
        for (const generatedId of this.generatedValues) {
            if (item[generatedId.attr])
                continue;

            let value: any;

            switch (generatedId.method) {
            case 'random':
                value = generatedId.prefix + randomHex(generatedId.length);
                break;

            case 'increment':
                value = generatedId.prefix + generatedId.nextId;
                generatedId.nextId++;
                break;

            case 'time_put':
                value = Date.now();
            }

            item[generatedId.attr] = value;
        }
    }

    prepare(newValue?: ValueType): ValueType {
        this._beforePut(newValue || ({} as any));
        return newValue;
    }

    put(newItem: ValueType, putInfo?: any): ValueType {

        if (header(newItem) && header(newItem).table)
            newItem = withoutHeader(newItem);

        if (ConfigFrequentValidation)
            this.internalValidate();

        // Prepare incoming data (add generated elements)
        this._beforePut(newItem);

        const attrs = objectToMap(newItem);

        let overwriteItem = null;

        // Check constraints
        for (const constraint of this.constraints) {
            switch (constraint.constraintType) {

            case 'required_attr':
                if (!attrs.has(constraint.attr))
                    throw this.usageError("put() failed, missing required attr: " + constraint.attr);
                break;

            case 'unique': {
                const indexKey = constraint.index.toKey(attrs);

                if (!indexKey)
                    continue;

                const existingItems = constraint.index.data.get(indexKey);

                if (existingItems) {
                    switch (constraint.onConflict) {

                    case 'ignore':
                        return existingItems.values().next().value;

                    case 'overwrite':
                        overwriteItem = existingItems.values().next().value;
                        break;

                    case 'error':
                        throw this.usageError(`put() failed, already have an item with ${constraint.index.attrs}=${indexKey}`);
                    }
                }

                break;
            }
            }
        }

        let tableInternalKey: number;

        // Commit
        if (overwriteItem) {

            tableInternalKey = header(overwriteItem).tableInternalKey;

            // Overwrite an existing object.
            initRowInfo(newItem, header(overwriteItem));

            this.items.set(tableInternalKey, newItem);

            // Update any existing incoming references.
            if (header(overwriteItem).referencers) {
                for (const referencer of header(overwriteItem).referencers.values()) {
                    referencer.value[referencer.attr] = newItem;
                }
            }

            clearHeader(overwriteItem);

        } else {
            tableInternalKey = this.nextInternalID.take()

            initRowInfo(newItem, {
                table: this,
                tableInternalKey,
            });

            this.items.set(tableInternalKey, newItem);
        }

        assert(tableInternalKey, 'missing tableInternalKey in commit');

        // Update any relevant indexes.
        for (const index of this.indexes) {
            if (index.coversAttrs(attrs)) {
                index.insert(tableInternalKey, attrs, newItem);
            }
        }

        // Update any references that this value points to.
        for (const reference of this.references) {
            const attr = reference.attr;

            const fieldValue = newItem[attr];
            if (fieldValue) {


                let referencedObject;

                if (reference.table) {

                    referencedObject = reference.table.getOneByAttrValue(reference.foreignAttr, fieldValue);
                    if (!referencedObject) {
                        throw new Error(`Table${reference.table.name() ? (' ' + reference.table.name()) : ''}`
                                        +` doesn't have a value for`
                                        +` ${reference.foreignAttr}=${fieldValue}`);
                    }
                } else {
                    referencedObject = fieldValue;
                }

                const referencedHeader = header(referencedObject);
                if (!referencedHeader)
                    throw this.usageError(`Value at ${attr} isn't a referenceable object`);

                if (!referencedHeader.referencers)
                    referencedHeader.referencers = new Map();

                const globalId = itemGlobalId(referencedHeader);
                referencedHeader.referencers.set(globalId, {
                    value: newItem,
                    attr,
                    onDelete: reference.onDelete
                });
            }
        }

        if (this.itemChangeListeners) {
            const itemData = withoutHeader(newItem);

            for (const listener of (this.itemChangeListeners || [])) {
                listener({ verb: 'put', item: itemData, writer: putInfo && putInfo.writer });
            }
        }

        if (ConfigFrequentValidation)
            this.internalValidate();

        return newItem;
    }

    putItems(items: ValueType[]) {
        for (const item of items)
            this.put(item);
    }

    *where(where: any): IterableIterator<ValueType> {
        // Check if this has no clause.
        if (!where) {
            yield* this.scan();
            return;
        }

        // Check if the 'where' is a valid object.
        const itemHeader = header(where);
        if (itemHeader && itemHeader.table === this) {
            yield where;
            return;
        }

        // Find a matching index.
        const attrs = Array.from(Object.keys(where));
        const attrsMap = objectToMap(where); // TODO, don't create a map here?

        for (const index of this.indexes) {
            if (index.matchesAttrList(attrs)) {
                yield* index.get(attrsMap);
                return;
            }
        }

        let message = `where() can't lookup by: [${attrs}]`;

        if (MemoryTableExtraErrorMessages) {

            if (this.indexes.length === 0) {
                message += `\n - Table ${this.name()} has no indexes`;
            } else {
                message += `\n - Table ${this.name()} has indexes for:`;
                for (const index of this.indexes) {
                  message += `\n     [${index.attrs.toString()}]`;
                }
            }
        }

        throw this.usageError(message);
    }

    getOneByAttrValue(attr: string, value: any): ValueType {
        const index = this.indexesBySingleAttr.get(attr);
        if (!index)
            throw this.usageError("can't getOneByAttrValue, no index for: " + attr);

        const key: AttrMap = new Map();
        key.set(attr, value);

        return index.getOne(key);
    }

    getOne(where: any): ValueType | null {
        for (const found of this.where(where)) {
            return found as any as ValueType;
        }

        return null;
    }

    list(): ValueType[] {
        return Array.from(this.items.values());
    }

    *scan() {
        for (const item of this.items.values()) {
            yield (item as any as ValueType)
        }
    }

    *scanWhere(where: any) {
        for (const item of this.scan()) {

            let match = true;
            for (const [ attr, expectedValue ] of Object.entries(where)) {
                if (item[attr] !== expectedValue) {
                    match = false;
                    break;
                }
            }

            if (match)
                yield item;
        }
    }

    *column(attr: string) {
        for (const item of this.scan()) {
            yield item[attr];
        }
    }

    columnList(attr: string): any[] {
        return Array.from(this.column(attr));
    }

    one(where?: any): ValueType | null {
        if (!where) {
            for (const item of this.scan())
                return item;
            return null;
        }

        for (const item of this.where(where))
            return item;
        return null;
    }

    listWhere(where: any): ValueType[] {
        return Array.from(this.where(where));
    }

    strs() {
        const out: string[] = [];
        for (const warning of this._warnings) {
            out.push(`#warning ${warning.warningType}${warning.message ? (' ' + warning.message) : ''}`);
        }

        for (const item of this.scan())
            out.push(formatItem(item));

        return out;
    }

    export() {
        const out = [];
        for (const item of this.scan()) {
            out.push(withoutHeader(item));
        }
        return out;
    }

    _deleteOne(item: ValueType, changeInfo?: any) {

        const itemHeader = header(item);

        assert(itemHeader, '_deleteOne item has no header');
        assert(itemHeader.tableInternalKey, '_deleteOne item has no tableInternalKey');

        this.items.delete(itemHeader.tableInternalKey);

        // Update indexes
        const attrs = objectToMap(item);
        for (const index of this.indexes) {
            if (index.coversAttrs(attrs)) {
                index.remove(itemHeader.tableInternalKey, attrs, item);
            }
        }

        // Update referencers
        if (itemHeader.referencers) {
            const referencers = itemHeader.referencers;
            itemHeader.referencers = null;

            for (const referencer of referencers.values()) {
                const resolution = referencer.onDelete;
                const referencerHeader = header(referencer.value);

                switch (resolution) {
                case 'cascade': {
                    const referencerTable = referencerHeader && referencerHeader.table;
                    if (referencerTable) {
                        referencerTable.delete(referencer.value);
                    }
                    // is it an error if referencerTable is not found?
                    break;
                }
                case 'set_null':
                    referencer.value[referencer.attr] = null;
                    break;
                }
            }
        }

        if (this.itemChangeListeners) {
            const toKey = this.itemToKey(item);
            for (const listener of (this.itemChangeListeners || [])) {
                listener({ verb: 'delete', item: toKey, writer: changeInfo && changeInfo.writer });
            }
        }

        // console.log('clearHeader', header(item));
        clearHeader(item);
    }

    delete(where: any, changeInfo?: any) {
        if (ConfigFrequentValidation)
            this.internalValidate();

        for (const found of this.where(where)) {
            this._deleteOne(found, changeInfo);
        }

        if (ConfigFrequentValidation)
            this.internalValidate();
    }

    deleteAll() {
        this.delete(null);
    }

    newRelatedTable(schema: TableSchema) {
        return this.graph.newTable(schema);
    }

    addChangeListener(listener: ItemChangeListener) {
        this.itemChangeListeners = this.itemChangeListeners || [];
        this.itemChangeListeners.push(listener);
    }

    internalValidate() {
        for (const [ tableInternalKey, item ] of this.items.entries()) {
            const itemHeader = header(item);
            if (itemHeader.table !== this) {
                throw new Error("item header .table is wrong: " + JSON.stringify(item));
            }
        }
    }

    usageError(message: string) {
        if (this._name)
            message = `[table ${this._name}] ${message}`;
        return new Error(message);
    }
    
    hasError() {
        return this._errors.length > 0;
    }

    warnings() {
        return this._warnings;
    }

    errors() {
        return this._errors;
    }
}

platformExtendClass(MemoryTable);

