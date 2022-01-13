
import { IDSource } from './utils/IDSource'
import { Table } from './Table'
import { Scope } from './Scope'
import { Stream } from './Stream'
import { Setup, SetupCallback } from './Setup'
import { Module } from './Module'
import { QueryTag, QueryLike, toQuery, Query, QueryTuple } from './Query'
import { StoredQuery } from './StoredQuery'
import { setupMap, MapMountConfig, setupObject, ObjectMountConfig, setupList, ListMountConfig } from './datastructures'
import { mountTable as mountMemoryTable, TableMountConfig } from './Table/mountTable'
import { TableSchema, LooseTableSchema, setupWithMountSpec, fixLooseSchema } from './Schema'
import { ItemChangeListener } from './reactive/ItemChangeEvent'
import { applyChangeToMountedTable } from './reactive/changePropogation'
import { randomHex } from './utils/randomHex'
import { applyTransform } from './Transform'
import { Item } from './Item'
import { setupBrowse } from './Browse'
import { ItemCallback, toTableBind, itemCallbackToHandler } from './Setup'
import { PlannedQuery, MountPointRef } from './PlannedQuery'
import { RunningQuery } from './RunningQuery'
import { graphToString } from './Debug'
import { Provider, newProviderTable } from './Providers'
import { MountPoint } from './MountPoint'
import { setupLoggingSubsystem, EmptyLoggingSubsystem } from './LoggingSubsystem'
import { getQueryMountMatch, QueryMountMatch } from './Matching'
import { AstModification } from './Block'

let _nextGraphID = new IDSource('graph-');

export interface QueryExecutionContext {
    env?: {
        [key: string]: any
    }
    parameters?: {
        [key: string]: any
    }
    mod?: AstModification
    input?: Stream
    readonly?: boolean
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

    constructor() {
        this.graphId = _nextGraphID.take() + randomHex(6);
    }

    setupBrowse() {
        this.createModule(setup => setupBrowse(setup));
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

        let setup = new Setup();
        setup = setupWithMountSpec(schema.mount, setup);

        mountMemoryTable(setup, table, opts);
        this.createModule(setup);
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

    mountMap(config: MapMountConfig) {
        const setup = new Setup();
        setupMap(setup, config);
        this.createModule(setup);
    }

    mountObject(config: ObjectMountConfig) {
        const setup = new Setup();
        setupObject(setup, config);
        return this.createModule(setup);
    }

    mountList(config: ListMountConfig) {
        return this.createModule(setup => {
            setupList(setup, config);
        });
    }

    mountFunc(decl: string, callback: ItemCallback) {
        return this.createModule(setup => {
            setup.table(toTableBind(decl, itemCallbackToHandler(callback)));
        });
    }

    mountTable(table: Table) {
        return this.createModule(setup => {
            mountMemoryTable(setup, table);
        });
    }

    *everyTable() {
        for (const module of this.modules)
            yield* module.points;
    }

    *everyMountPoint() {
        for (let moduleIndex=0; moduleIndex < this.modules.length; moduleIndex++) {
            const module = this.modules[moduleIndex];
            for (const point of module.points)
                yield point;
        }
    }

    *getQueryMountMatches(tuple: QueryTuple) {
        for (const point of this.everyTable()) {
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

    createModule(setup: Setup | SetupCallback) {
        let setupObj;
        if (setup instanceof Setup)
            setupObj = setup;
        else {
            setupObj = new Setup();
            setup(setupObj);
        }
        const module = this.createEmptyModule();
        module.redefine(setupObj.toMountSpec());
        return module;
    }

    createEmptyModule() {
        const module = new Module(this);
        this.modules.push(module);
        this.modulesById.set(module.moduleId, module);
        return module;
    }

    query(queryLike: QueryLike, parameters: any = {}, context: QueryExecutionContext = {}) {
        const query = toQuery(queryLike, { graph: this });
        const planned = new PlannedQuery(this, query, context);
        const running = new RunningQuery(this, planned, context);
        return running.output;
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

    str(options: { reproducible?: boolean } = {}) {
        return graphToString(this, options);
    }
}

export function newGraph() {
    return new Graph();
}
