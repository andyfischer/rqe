
import { parseSingleQueryFromString } from '../parser/parseQuery'
import { Table } from './Table'
//import { Query, QueryTuple } from '../query/Query'
import { Schema, SchemaAttr, IndexSchema } from './Schema'
import { Stream } from '../Stream'
import { getWithAttr, hasWithAttr, getSingleValue, listWithAttr, listAll, each, count,
        updateAll, updateWithAttr,
        preInsert, insert, sendToListeners, deleteWithAttr, deleteAll, replaceAll } from './RuntimeFunctions'
import { Query } from '../query'

export interface SchemaDecl {
    name: string
    attrs?: string[]
    funcs?: string[]
}

export function compileSchema<ItemType = any>(decl: SchemaDecl): Schema<Table<ItemType>> {
    const schema = new Schema(decl);
    const schemaName = decl.name;
    const attrByStr = new Map<string, SchemaAttr>();
    const indexesNeeded = new Map<string, {needsMulti?:boolean} >();

    function needIndexForAttr(attr: string, multipleValuesPerKey: boolean) {
        if (!indexesNeeded.has(attr))
            indexesNeeded.set(attr, {});
        if (multipleValuesPerKey)
            indexesNeeded.get(attr).needsMulti = true;
    }

    function declareFunc(funcName, handler: any /*fixme*/) {
        schema.funcs.set(funcName, {
            name: funcName,
            handler,
        });
    }

    // parse decl.attrs
    for (const attrDecl of decl.attrs || []) {
        let parsed = parseSingleQueryFromString(attrDecl);

        if (parsed.t === 'parseError')
            throw new Error("parse error on: " + attrDecl);

        parsed = parsed as Query;

        // first tag should be the attr name
        const attrName = parsed.tags[0].attr;

        const attrInfo = new SchemaAttr(attrName);

        if (attrByStr.has(attrName))
            throw new Error("duplicate attr: " + attrName);

        for (const tag of parsed.tags.slice(1)) {
            if (tag.attr === 'auto') {
                attrInfo.isAuto = true;
                continue;
            }

            throw new Error(`unrecognized tag on attr "${attrName}": ${tag.attr}`);
        }

        attrByStr.set(attrName, attrInfo);
        schema.attrs.push(attrInfo);
    }

    // parse decl.funcs
    for (const funcDecl of decl.funcs || []) {
        let parsed = parseSingleQueryFromString(funcDecl);
        if (parsed.t === 'parseError')
            throw new Error("parse error on: " + funcDecl);

        parsed = parsed as Query;
        const parsedFuncName = parsed.tags[0].attr;
        
        // console.log(`parsed func decl (${funcDecl}):`, parsed)

        if (parsedFuncName === 'get' && parsed.tags[0].isQuery()) {
            // Single attr get
            const getArgs = (parsed.tags[0].value as Query);

            if (getArgs.tags.length !== 1) {
                throw new Error("not supported yet: get() with multple attrs")
            }

            const getAttr = getArgs.tags[0].attr;

            needIndexForAttr(getAttr, false);

            const funcName = 'get_with_' + getAttr;
            declareFunc(funcName, (table: Table, args) =>
                getWithAttr(schema, funcName, getAttr, table, args)
            );

            continue;
        }

        if (parsedFuncName === 'get' && parsed.tags[0].value == null) {
            // Single value get
            let funcName = 'get';
            declareFunc(funcName, (table: Table, args) => {
                if (args.length !== 0)
                    throw new Error(`(${schemaName}).${funcName} usage error: expected zero args`)

                return getSingleValue(schema, funcName, table);
            });

            const index = new IndexSchema();
            index.indexType = 'single_value'
            schema.indexes.push(index)

            continue;
        }

        if (parsedFuncName === 'has') {
            const hasArgs = (parsed.tags[0].value as Query)

            if (!hasArgs)
                throw new Error("has() requires a parameter")

            if (hasArgs.tags.length === 0)
                throw new Error("has() requires a parameter")

            if (hasArgs.tags.length !== 1) {
                throw new Error("not supported yet: has() with multple attrs")
            }

            const hasAttr = hasArgs.tags[0].attr;

            needIndexForAttr(hasAttr, false);

            const funcName = 'has_' + hasAttr;

            declareFunc(funcName, (table: Table, args) => {
                return hasWithAttr(schema, funcName, hasAttr, table, args);
            });

            continue;
        }

        if (parsedFuncName === 'list') {
            const listArgs = (parsed.tags[0].value as Query)

            if (!listArgs || !listArgs.tags || listArgs.tags.length === 0)
                throw new Error("expected one param for list()");

            if (listArgs.tags.length !== 1)
                throw new Error("not supported yet: get() with multple attrs")

            const listAttr = listArgs.tags[0].attr;

            needIndexForAttr(listAttr, true);

            const funcName = 'list_with_' + listAttr;
            declareFunc(funcName, (table: Table, args) => {
                return listWithAttr(schema, funcName, listAttr, table, args);
            });

            continue;
        }

        if (parsedFuncName === 'listAll') {
            const funcName = 'listAll';
            declareFunc(funcName, (table: Table, args) => {
                return listAll(schema, funcName, table);
            });
            continue;
        }

        if (parsedFuncName === 'update') {
            let args: Query= null;

            if (parsed.tags[0] && parsed.tags[0].isQuery()) {
                args = (parsed.tags[0].value as Query)
            }

            if (!args) {
                const funcName = 'update';
                declareFunc(funcName, (table: Table, args) => {
                    return updateAll(schema, funcName, table, args);
                });
            } else if (args.tags.length === 1) {
                const attr = args.tags[0].attr;
                needIndexForAttr(attr, false);
                const funcName = 'update_with_' + attr;
                declareFunc(funcName, (table: Table, args) => {
                    return updateWithAttr(schema, funcName, attr, table, args);
                });
            } else {
                throw new Error("unexpected: update() has more than one param");
            }
            continue;
        }

        if (parsedFuncName === 'each') {
            declareFunc('each', function *handler(table: Table, args) {
                yield* each(table);
            });
            continue;
        }

        if (parsedFuncName === 'listen') {
            schema.supportsListening = true;

            declareFunc('listen', (table: Table, args) => {
                let listenerStreams = table.listenerStreams;
                const stream = new Stream();
                listenerStreams.push(stream);
                return stream;
            });
            continue;
        }

        if (parsedFuncName === 'delete') {
            const deleteArgs = (parsed.tags[0].value as Query);
            const attr = deleteArgs.tags[0].attr;
            const funcName = 'delete_with_' + attr;

            needIndexForAttr(attr, false);

            declareFunc(funcName, (table: Table, args) => {
                return deleteWithAttr(schema, funcName, attr, table, args);
            });

            continue;
        }

        if (parsedFuncName === 'deleteAll') {
            declareFunc('deleteAll', (table: Table, args) => {
                return deleteAll(schema, table, args);
            });

            continue;
        }

        if (parsedFuncName === 'replaceAll') {
            declareFunc('replaceAll', (table: Table, args) => {
                return replaceAll(schema, table, args);
            });

            continue;
        }

        if (parsedFuncName === 'getStatus') {
            schema.supportsStatusTable = true;
            continue;
        }

        if (parsedFuncName === 'count') {
            declareFunc('count', (table: Table, args) => {
                return count(schema, table, args);
            });
            continue;
        }

        throw new Error("unrecognized func: " + parsed.tags[0].attr);
    }

    // default functions: 'insert' and 'preInsert'
    declareFunc('preInsert', (table: Table, args) => {
        if (args.length !== 1)
            throw new Error(`(${schemaName}).preInsert usage error: expected a single arg (item)`)

        const item = args[0];

        preInsert(schema, table, item);
    });

    declareFunc('insert', (table: Table, args) => {
        return insert(schema, 'insert', table, args);
    });

    // single value 'get' implies 'set'
    if (schema.funcs.has('get')) {
        let funcName = 'set'

        declareFunc(funcName, (table: Table, args) => {
            if (args.length !== 1)
                throw new Error(`${schemaName}.${funcName} usage error: expected a single arg`)

            const item = args[0]

            if (table.indexType !== 'single_value')
                throw new Error(`${schemaName}.${funcName} internal error: expected 'single_value' index`)

            table.items[0] = item;

            if (schema.supportsListening)
                sendToListeners(schema, table, { t: 'item', item });
        });
    }

    // Create indexes for indexesNeeded
    for (const [ attr, indexInfo ] of indexesNeeded.entries()) {
        const index = new IndexSchema();
        index.name = attr;
        index.indexType = indexInfo.needsMulti ? 'multimap' : 'map'
        index.attrs = [attr]
        schema.indexes.push(index);
    }

    // maybe add init_listener_streams
    if (schema.supportsListening) {
        schema.setupTable.push({ t: 'init_listener_streams' });
    }

    // any attrs with isAuto need an PreInsertStep
    for (const attr of schema.attrs) {
        if (attr.isAuto) {
            schema.setupTable.push({t: 'init_table_auto_attr', attr: attr.attr });
            schema.preInsert.push({t: 'init_auto_attr', attr: attr.attr});
        }
    }

    // if we didn't find any indexes, create a ListIndex
    if (schema.indexes.length == 0) {
        const index = new IndexSchema();
        index.indexType = 'list';
        schema.indexes.push(index)
    }

    // Figure out the primary unique index
    for (const index of schema.indexes) {
        if (index.indexType === 'map' && index.attrs.length === 1) {
            schema.primaryUniqueIndex = index;
            break;
        }
    }

    // Figure out the default index
    if (schema.primaryUniqueIndex) {
        schema.defaultIndex = schema.primaryUniqueIndex;
    } else {
        for (const index of schema.indexes) {
            schema.defaultIndex = index;
            break;
        }
    }

    // Add some functions that rely on having a primary unique index
    if (schema.primaryUniqueIndex) {
        const primaryUniqueAttr = schema.primaryUniqueIndex.attrs[0];

        declareFunc('item_to_uniqueKey', (table: Table, args) => {
            if (args.length !== 1)
                throw new Error('item_to_uniqueKey expected 1 arg');

            const item = args[0];

            return item[primaryUniqueAttr];
        });

        declareFunc('item_matches_uniqueKey', (table: Table, args) => {
            if (args.length !== 2)
                throw new Error('item_matches_uniqueKey expected 2 args');

            const item = args[0];
            const uniqueKey = args[1];

            return item[primaryUniqueAttr] === uniqueKey;
        });
    }

    return schema;
}
