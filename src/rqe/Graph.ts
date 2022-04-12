
import { IDSource } from './utils/IDSource'
import { Table } from './Table'
import { Stream } from './Stream'
import { Module } from './Module'
import { QueryLike, toQuery, Query, QueryStep } from './Query'
import { StoredQuery } from './StoredQuery'
import { setupMap, MapMountConfig, setupObject, ObjectMountConfig, getListMount, ListMountConfig,
    getTableMount, TableMountConfig, setupFunction } from './mountlib'
import { LooseTableSchema, fixLooseSchema } from './Schema'
import { ItemChangeListener } from './reactive/ItemChangeEvent'
import { randomHex } from './utils/randomHex'
import { applyTransform } from './Transform'
import { Item } from './Item'
import { setupBrowse } from './mountlib/browseGraph'
import { ItemCallback, toTableBind, itemCallbackToHandler } from './Setup'
import { PlannedQuery } from './Planning'
import { MountPointRef } from './FindMatch'
import { RunningQuery } from './RunningQuery'
import { graphToString } from './Debug'
import { Provider, newProviderTable } from './Providers'
import { MountPoint, MountPointSpec } from './MountPoint'
import { setupLoggingSubsystem, EmptyLoggingSubsystem } from './LoggingSubsystem'
import { getQueryMountMatch } from './FindMatch'
import { Verb } from './verbs/_shared'
import { getVerb } from './verbs/_list'
import { callPoint } from './CallPoint'
import { CustomType } from './CustomType'
import { CollectedMountGraph } from './CollectedMounts'

let _nextGraphID = new IDSource('graph-');

export interface QueryExecutionContext {
    env?: {
        [key: string]: any
    }
    readonly?: boolean
}

export interface QueryParameters {
    '$input'?: Stream
    [name: string]: any
}

export class Graph {
    graphId: string
    anonTableName = new IDSource('anontable-');
    nextTableId = new IDSource('table-');
    nextModuleId = new IDSource('module-');
    modules: Module[] = [];
    modulesById = new Map<string, Module>();
    tables = new Map<string, Table>()
    tablesByName = new Map<string, Table>()
    schemaListeners: ItemChangeListener[] = []
    providerTable: Table<Provider>
    tableRedefineOnExistingName = false
    logging = new EmptyLoggingSubsystem()
    customVerbs: Table<{ name: string, def: Verb}>
    customTypes: Table<{ name: string, def: CustomType}>
    _collectedMounts: CollectedMountGraph

    constructor() {
        this.graphId = _nextGraphID.take() + randomHex(6);
    }

    setupBrowse() {
        this.createModuleV2(setupBrowse(this));
    }

    enableLogging() {
        setupLoggingSubsystem(this);
    }

    tablesIt() {
        return this.tables.values();
    }

    addTable(table: Table, opts: TableMountConfig = {}) {
        const schema = table.schema;

        if (this.tablesByName.has(table.name)) {
            if (this.tableRedefineOnExistingName) {
                return this.tablesByName.get(table.name) as Table;
            }

            throw new Error("Already have a table with name: " + table.name);
        }

        const id = table.tableId || this.nextTableId.take();
        
        this.tables.set(id, table);
        this.tablesByName.set(table.name, table);
        this.mountTable(table, opts);
    }

    newTable<T = any>(schema?: LooseTableSchema): Table<T> {
        schema = schema || {};
        schema.name = schema.name || this.anonTableName.take();

        schema = fixLooseSchema(schema);
        const tableId = this.nextTableId.take();
        const table = new Table<T>(schema, { tableId });

        this.addTable(table);

        return table;
    }

    mount(points: MountPointSpec[]) {
        const module = this.createEmptyModule();
        module.redefine(points);
        return module;
    }

    mountMap(config: MapMountConfig) {
        this.createModuleV2(setupMap(config));
    }

    mountObject(config: ObjectMountConfig) {
        return this.createModuleV2(setupObject(config));
    }

    mountList(config: ListMountConfig) {
        const module = this.createEmptyModule();
        module.redefine(getListMount(config));
        return module;
    }

    func(decl: string, callback: ItemCallback) {
        return this.createModuleV2([setupFunction(decl, callback)]);
    }

    mountTable(table: Table, opts: TableMountConfig = {}) {
        const module = this.createEmptyModule();
        module.redefine(getTableMount(table, opts));
        return module;
    }

    *everyMountPoint() {
        for (const module of this.modules)
            yield* module.points;
    }

    *getQueryMountMatches(tuple: QueryStep) {
        for (const point of this.everyMountPoint()) {
            const match = getQueryMountMatch(tuple, point);

            if (match)
                yield {point,match};
        }
    }

    getMountPoint(ref: MountPointRef): MountPoint {
        const module = this.modulesById.get(ref.moduleId);
        if (!module)
            return null;
        return module.pointsById.get(ref.pointId);
    }

    findTableByName(name: string) {
        for (const module of this.modules)
            for (const table of module.points)
                if (table.name === name)
                    return table;
        return null;
    }

    createModuleV2(points: MountPointSpec[]) {
        const module = this.createEmptyModule();
        module.redefine(points);
        return module;
    }

    createEmptyModule() {
        const module = new Module(this);
        this.modules.push(module);
        this.modulesById.set(module.moduleId, module);
        return module;
    }

    query(queryLike: QueryLike, parameters: QueryParameters = {}, context: QueryExecutionContext = {}) {
        const query = toQuery(queryLike, { graph: this });
        const planned = new PlannedQuery(this, query, context);
        const running = new RunningQuery(this, planned, parameters, context);
        return running.output;
    }

    transform(queryLike: QueryLike, items: Item[], parameters: QueryParameters = {}, context: QueryExecutionContext = {}) {
        const query = toQuery(queryLike, { graph: this });

        if (query.steps[0].verb === 'get')
            throw new Error("Expected a transforming query: " + queryLike);

        const planned = new PlannedQuery(this, query, context);

        parameters.$input = Stream.fromList(items);
        const running = new RunningQuery(this, planned, parameters, context);
        return running.output;
    }

    planQuery(queryLike: QueryLike, context: QueryExecutionContext = {}) {
        const query = toQuery(queryLike, { graph: this });
        const planned = new PlannedQuery(this, query, context);
        return planned;
    }

    put(object: any): Stream {
        return this.query({
            attrs: {
                ...object,
                'put!': null,
            }
        });
    }

    prepareQuery(queryLike: QueryLike): Query {
        return toQuery(queryLike, { graph: this });
    }

    prepareTransform(queryLike: QueryLike): Query {
        return toQuery(queryLike, { graph: this });
    }

    callMountPoint(context: QueryExecutionContext, pointRef: MountPointRef, tuple: QueryStep, input: Stream, output: Stream) {
        callPoint(this, context, pointRef, tuple, input, output);
    }

    applyTransform(items: Item[], queryLike: QueryLike): Stream {
        return applyTransform(this, items, this.prepareTransform(queryLike));
    }

    callPrepared(prepared: StoredQuery, values: { [attr: string]: any }): Stream {
        const query = prepared.withValues(values);
        return this.query(query);
    }

    providers(): Table<Provider> {
        if (!this.providerTable)
            this.providerTable = newProviderTable(this);

        return this.providerTable;
    }

    addSchemaListener(listener: ItemChangeListener, { backlog }: { backlog?: boolean } = {}) {
        if (backlog) {
            for (const module of this.modules) {
                module.sendUpdate(listener);
            }
        }

        this.schemaListeners.push(listener);
    }

    addCustomVerb(name: string, def: Verb) {
        if (!this.customVerbs) {
            this.customVerbs = this.newTable({
                funcs: [
                    'name -> def'
                ]
            });
        }
    
        this.customVerbs.put({name, def});
    }

    getVerb(name: string) {
        if (this.customVerbs) {
            const foundCustom = this.customVerbs.one({name});
            if (foundCustom)
                return foundCustom.def;
        }

        return getVerb(name);
    }

    addCustomType(name: string, def: CustomType) {
        if (!this.customTypes) {
            this.customTypes = this.newTable({
                attrs: {
                    name: {},
                    def: {},
                },
                funcs: [
                    'name ->'
                ],
            });
        }

        this.customTypes.put({name,def});
    }

    getCustomType(name: string) {
        if (this.customTypes) {
            const found = this.customTypes.one({name});
            return found.def;
        }
    }

    newStream(label?: string) {
        return new Stream(label);
    }

    str(options: { reproducible?: boolean } = {}) {
        return graphToString(this, options);
    }

    collectedMounts() {
        if (!this._collectedMounts)
            this._collectedMounts = new CollectedMountGraph(this);
        return this._collectedMounts;
    }
}

export function newGraph() {
    return new Graph();
}
