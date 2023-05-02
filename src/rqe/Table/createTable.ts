
import { Schema } from './Schema'
import { Table, TableIndex } from './Table'
import { initializeNewTableWithStatus } from './StatusTable'
import { checkInvariantsOnTable } from './checkInvariants'

export function createTable(schema: Schema): Table {
    const indexes = new Map<string,TableIndex>()
    let defaultIndex = null;

    for (const schemaIndex of schema.indexes) {
        const newTableIndex = schemaIndex.createForTable()
        indexes.set(schemaIndex.name, newTableIndex);

        if (schema.defaultIndex && schemaIndex.name === schema.defaultIndex.name) {
            defaultIndex = newTableIndex;
        }
    }

    const attrData = new Map()

    const tableObject = {
        schema,
        indexes,
        attrData,
        items: defaultIndex && defaultIndex.items,
        indexType: defaultIndex && defaultIndex.indexType,
        listenerStreams: null,
        supportsFunc(funcName: string) {
            return schema.funcs.has(funcName)
        },
        checkInvariants() {
            checkInvariantsOnTable(tableProxy)
        }
    };

    let tableProxy: Table;

    // Create callbacks for each func
    for (const [ name, func ] of schema.funcs) {
        tableObject[name] = (...args) => {
            return func.handler(tableProxy, args);
        }
    }

    // Run initializiation steps
    for (const step of schema.setupTable) {
        switch (step.t) {
        case 'init_table_auto_attr': {
            if (!attrData.has(step.attr))
                attrData.set(step.attr, {})
            attrData.get(step.attr).next = 1;
            break;
        }
        case 'init_listener_streams': {
            tableObject.listenerStreams = [];
            break;
        }
        }
    }

    if (schema.supportsStatusTable)
        initializeNewTableWithStatus(tableProxy, tableObject);

    // Create a proxy for better errors (todo- make this an optional debugging mode)
    tableProxy = new Proxy(tableObject, {
        get(target, methodOrAttributeName) {
            if (target.hasOwnProperty(methodOrAttributeName)) {
                return target[methodOrAttributeName];
            }

            // error case
            if (methodOrAttributeName === 'listen') {
                throw new Error(
                    `Schema ${schema.name} doesn't support .listen() (fix: add 'listen' to funcs)`);
            }

            throw new Error(`${schema.name} doesn't support: ${String(methodOrAttributeName)}`);
        }
    });

    return tableProxy;
}
