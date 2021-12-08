
import { IDSource } from './utils/IDSource'
import { MemoryTable } from './MemoryTable'
import { runPipedQuery } from './runQuery'
import { Scope } from './Scope'
import { Stream } from './Stream'
import { Setup, SetupCallback } from './Setup'
import { Module } from './Module'
import { QueryTag, QueryLike, toQuery, Query } from './Query'
import PreparedQuery from './PreparedQuery'
import { mountMap, MapMountConfig } from './commonMounts/map'
import { mountObject, ObjectMountConfig } from './commonMounts/object'
import { mountList, ListMountConfig } from './commonMounts/list'
import { mountTable as mountMemoryTable } from './MemoryTable/mountTable'
import { TableSchema, LooseTableSchema, setupWithMountSpec, fixLooseSchema } from './Schema'
import { Table, ItemChangeListener } from './Table'
import { applyChangeToMountedTable } from './reactive/changePropogation'
import { randomHex } from './utils/randomHex'
import { applyTransform } from './Transform'
import { Item } from './Item'
import { setupBrowse } from './Browse'

let _nextGraphID = new IDSource('graph-');

export class Graph {
    graphId: string
    anonTableName = new IDSource('anontable-');
    nextTableId = new IDSource('table-');
    modules: Module[] = [];
    tables = new Map<string, Table>()
    tablesByName = new Map<string, Table>()
    tableSetListeners: ItemChangeListener[]
    
    tableRedefineOnExistingName = false

    constructor() {
        this.graphId = _nextGraphID.take() + randomHex(6);
        this.setupBuiltins();
    }

    setupBuiltins() {
        this.createModule(setup => setupBrowse(setup));
    }

    tablesIt() {
        return this.tables.values();
    }

    newTable<T = any>(schema?: LooseTableSchema): MemoryTable<T> {
        schema = schema || {};
        schema.name = schema.name || this.anonTableName.take();

        schema = fixLooseSchema(schema);
        const table = new MemoryTable<T>(schema, { graph: this });
        this.tables.set(table.tableId, table);

        if (this.tablesByName.has(schema.name)) {
            if (this.tableRedefineOnExistingName) {
                return this.tablesByName.get(schema.name) as MemoryTable<T>;
            }

            throw new Error("Already have a table with name: " + schema.name);
        }

        this.tablesByName.set(schema.name, table);

        if (schema.mount) {
            const setup = new Setup();
            setupWithMountSpec(schema.mount, setup);
            mountMemoryTable(setup, table);

            this.createModule(setup);
        }

        if (this.tableSetListeners) {
            for (const listener of this.tableSetListeners) {
                listener({
                    verb: 'put',
                    item: {
                        name: schema.name,
                        table,
                    }
                })
            }
        }

        return table;
    }

    mountMap(config: MapMountConfig) {
        const setup = new Setup();
        mountMap(setup, config);
        this.createModule(setup);
    }

    mountObject(config: ObjectMountConfig) {
        const setup = new Setup();
        mountObject(setup, config);
        return this.createModule(setup);
    }

    mountList(config: ListMountConfig) {
        return this.createModule(setup => {
            mountList(setup, config);
        });
    }

    mountTable(table: MemoryTable) {
        return this.createModule(setup => {
            mountMemoryTable(setup, table);
        });
    }

    *everyTable() {
        for (const module of this.modules)
            yield* module.tables;
    }

    findTableByName(name: string) {
        for (const module of this.modules)
            for (const table of module.tables)
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
        module.redefine(setupObj);
        return module;
    }

    createEmptyModule() {
        const module = new Module();
        this.modules.push(module);
        return module;
    }

    query(queryLike: QueryLike, input?: Stream): Stream {
        const query = toQuery(queryLike, { graph: this });
        const scope = new Scope(this);
        input = input || Stream.newEmptyStream();
        return runPipedQuery(scope, query, input);
    }

    prepareQuery(queryLike: QueryLike): Query {
        return toQuery(queryLike, { graph: this });
    }

    prepareTransform(queryLike: QueryLike): Query {
        return toQuery(queryLike, { graph: this });
    }

    applyTransform(items: Item[], queryLike: QueryLike): Item[] {
        return applyTransform(this, items, this.prepareTransform(queryLike));
    }

    put(object: any): Stream {
        return this.query({
            attrs: {
                ...object,
                put: true
            }
        });
    }

    callPrepared(prepared: PreparedQuery, values: { [attr: string]: any }): Stream {
        const query = prepared.withValues(values);
        return this.query(query);
    }

    addTableSetListener(listener: ItemChangeListener) {
        this.tableSetListeners = this.tableSetListeners || [];
        this.tableSetListeners.push(listener);
    }
}

export function newGraph() {
    return new Graph();
}
