
import { Handler } from '../handler'
import { parseQuery } from '../parser'
import { Query } from '../query'
import { Stream } from '../Stream'
import { compileSchema, Table, Schema } from '../table'
import { GraphModule } from './GraphModule'
import { declaredFunctionToHandler } from '../handler/NativeCallback';
import { createPlan, ExpectedValue, executePlan } from '../query'

export type QueryLike = string | Query
export type QueryParameters = any

const schema_modules = compileSchema({
    name: 'graph.modules',
    attrs: [
        'id(auto)'
    ],
    funcs: [
        'listAll',
        'get(id)',
        'each',
    ]
})

const schema_graphTables = compileSchema({
    name: 'graph.tables',
    attrs: [
        'id(auto)'
    ],
    funcs: [
        'get(id)',
        'has(name)',
        'get(name)',
        'listAll',
        'each',
    ]
})

export interface GraphLike {
    query(queryLike: QueryLike, params?: QueryParameters): Stream
}

export function toQuery(queryLike: QueryLike): Query {
    if (typeof queryLike === 'string') {
        const parsed = parseQuery(queryLike);

        if (parsed.t === 'parseError')
            throw parsed;

        return parsed as Query;
    }

    return queryLike;
}

interface GraphTable {
    id?: string
    name: string
    table: Table
}

export class Graph implements GraphLike {

    modules: Table<GraphModule>
    tables: Table<GraphTable>

    constructor() {
        this.modules = schema_modules.createTable();
        this.tables = schema_graphTables.createTable();
    }

    newModule() {
        const module = new GraphModule(this);
        this.modules.insert(module);
        return module;
    }

    onModuleChange(module: GraphModule) {
    }

    query(queryLike: QueryLike, params?: QueryParameters): Stream {
        const query = toQuery(queryLike);
        params = params || new Map();
        const expectedInput: ExpectedValue = params.has('$input') ? { t: 'some_value' } : { t: 'no_value' };
        const plan = createPlan(this, {}, query, expectedInput);

        const output = new Stream();

        executePlan(plan, params, output);
        return output;
    }

    mount(handlers: Handler[]) {
        const module = this.newModule();
        module.redefine(handlers);
        return module;
    }

    exposeFunc(decl: string, func: Function) {
        const handler = declaredFunctionToHandler(decl, func);
        this.mount([ handler ]);
    }

    *eachHandler() {
        for (const module of this.modules.each()) {
            for (const handler of module.handlers) {
                yield handler;
            }
        }
    }

    getTable<T = any>(schema: Schema<Table<T>>) {
        if (!this.tables.has_name(schema.name)) {
            this.tables.insert( { name: schema.name, table: schema.createTable() });
        }

        const entry = this.tables.get_with_name(schema.name);
        return entry.table;
    }
}
