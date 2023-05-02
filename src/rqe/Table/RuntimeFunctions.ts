
import { Table } from './Table'
import { Schema } from './Schema'
import { MapIndex, MultiMapIndex, ListIndex, SingleValueIndex } from './Table'
import { StreamEvent } from '../Stream'

export function preInsert(schema: Schema, table: Table, item) {
    for (const step of schema.preInsert) {
        switch (step.t) {
        case 'init_auto_attr':
            if (item[step.attr] != null)
                continue;

            const attrData = table.attrData.get(step.attr);
            if (!attrData) {
                throw new Error(`(${schema.name}) internal error: expected to find attrData for: ${step.attr}`)
            }
            const next = attrData.next;
            attrData.next++;
            item[step.attr] = next;
            break;
        }
    }

    return item;
}

export function insert(schema: Schema, funcName: string, table: Table, args: any[]) {
    if (args.length !== 1)
        throw new Error(`(${schema.name}).insert usage error: expected a single arg (item)`)

    const item = args[0];

    if (item == null)
        throw new Error("value error: item is null")

    preInsert(schema, table, item);

    // Store object - update every index
    for (const indexSchema of schema.indexes) {
        const index = table.indexes.get(indexSchema.name);

        switch (indexSchema.indexType) {
        case 'map': {
            if (indexSchema.attrs.length !== 1)
                throw new Error("not supported yet: indexes on multiple attrs");
            const indexKey = item[indexSchema.attrs[0]];
            (index as MapIndex).items.set(indexKey, item);
            break;
        }
        case 'multimap': {
            if (indexSchema.attrs.length !== 1)
                throw new Error("not supported yet: indexes on multiple attrs");
            const indexKey = item[indexSchema.attrs[0]];
            (index as MultiMapIndex).items.add(indexKey, item);
            break;
        }
        case 'list': {
            (index as ListIndex).items.push(item);
            break;
        }
        case 'single_value': {
            (index as SingleValueIndex).items[0] = item;
            break;
        }
        default:
            throw new Error(`${funcName} internal error: unexpected index type ${indexSchema.indexType}`);
        }
    }

    if (schema.supportsListening)
        sendToListeners(schema, table, { t: 'item', item });

    return item;
}

export function updateAll(schema: Schema, funcName: string, table: Table, args: any[]) {
    if (args.length !== 1)
        throw new Error(`(${schema.name}).update usage error: expected a single arg (callback)`);

    const callback = args[0];

    for (const indexSchema of schema.indexes) {
        const index = table.indexes.get(indexSchema.name);

        switch (indexSchema.indexType) {
        case 'map': {
            if (indexSchema.attrs.length !== 1)
                throw new Error("not supported yet: indexes on multiple attrs");

            const items = (index as MapIndex).items;

            for (const [ existingKey, item ] of items.entries()) {
                const newItem = callback(item) || item;
                const newKey = newItem[indexSchema.attrs[0]];
                if (existingKey !== newKey) {
                    items.delete(existingKey);
                    items.set(newKey, newItem);
                } else {
                    items.set(existingKey, newItem);
                }
                if (schema.supportsListening)
                    sendToListeners(schema, table, { t: 'item', item: newItem });
            }
            break;
        }
        case 'multimap': {
            throw new Error("not implemented yet: update on multimap")
            break;
        }
        case 'list': {
            const items = (index as ListIndex).items;
            for (let i = 0; i < items.length; i++) {
                items[i] = callback(items[i]) || items[i];
                if (schema.supportsListening)
                    sendToListeners(schema, table, { t: 'item', item: items[i] });
            }
            break;
        }
        case 'single_value': {
            const items = (index as SingleValueIndex).items;

            items[0] = callback(items[0]) || items[0];
            if (schema.supportsListening)
                sendToListeners(schema, table, { t: 'item', item: items[0] });
            break;
        }
        default:
            throw new Error(`${funcName} internal error: unexpected index type ${indexSchema.indexType}`);
        }
    }
}

export function updateWithAttr(schema: Schema, funcName: string, attr: string, table: Table, args: any[]) {
    const index = table.indexes.get(attr);

    if (!index)
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${attr}`);

    const existingKey = args[0];
    const callback = args[1];

    switch (index.indexType) {
    case 'map': {
        if (table.schema.indexes.length > 1)
            throw new Error("not implemented yet: updating other indexes when doing updateWithAttr");

        const items = (index as MapIndex).items;
        const item = items.get(existingKey);

        const newItem = callback(item) || item;
        const newKey = newItem[attr];
        if (existingKey !== newKey) {
            items.delete(existingKey);
            items.set(newKey, newItem);
        } else {
            items.set(existingKey, newItem);
        }

        if (schema.supportsListening)
            sendToListeners(schema, table, { t: 'item', item: newItem });

        break;
    }
    case 'multimap': {
        throw new Error("not implemented yet: update on multimap")
        break;
    }
    case 'list': {
        throw new Error("not implemented: updateWithAttr on list index")
    }
    case 'single_value': {
        throw new Error("not implemented: updateWithAttr on single_value index")
    }
    default:
        throw new Error(`${funcName} internal error: unexpected index type ${(index as any).indexType}`);
    }
}

export function getWithAttr(schema: Schema, funcName: string, attr: string, table: Table, args: any[]) {
    const index = table.indexes.get(attr);

    if (!index)
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${attr}`);

    if (args.length !== 1)
        throw new Error(`(${schema.name}).${funcName} usage error: expected a single arg (indexed value)`)

    const indexedValue = args[0];

    switch (index.indexType) {
    case 'map':
        return index.items.get(indexedValue)
    case 'multimap':
        return index.items.get(indexedValue)[0]
    }

    throw new Error(`Schema (${schema.name}) internal error: 'get' func didn't expect index type: ${index.indexType}`)
}

export function hasWithAttr(schema: Schema, funcName: string, attr: string, table: Table, args: any[]): boolean {
    const index = table.indexes.get(attr);

    if (!index)
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${attr}`);

    if (args.length !== 1)
        throw new Error(`(${schema.name}).${funcName} usage error: expected a single arg (indexed value)`)

    const indexedValue = args[0];

    switch (index.indexType) {
    case 'map':
        return index.items.has(indexedValue)
    case 'multimap':
        return index.items.has(indexedValue);
    }

    throw new Error(`Schema (${schema.name}) internal error: 'get' func didn't expect index type: ${index.indexType}`)
}

export function getSingleValue(schema: Schema, funcName: string, table: Table) {
    switch (table.indexType) {
        case 'map':
            return Array.from(table.items.values());
        case 'multimap':
            return Array.from(table.items.values());
        case 'single_value':
            return table.items[0]
    }

    throw new Error(`Schema (${schema.name}) internal error: 'get' func didn't expect index type: ${table.indexType}`)
}

export function listAll(schema: Schema, funcName: string, table: Table) {
    switch (table.indexType) {
        case 'map':
            return Array.from(table.items.values());
        case 'multimap':
            return Array.from(table.items.values());
        case 'list':
            return table.items;
        case 'single_value':
            if (table.items[0] == null)
                return []
            return table.items;
    }

    throw new Error(`Schema (${schema.name}) internal error: 'listAll' func didn't expect index type: ${table.indexType}`)
}

export function sendToListeners(schema: Schema, table: Table, evt: StreamEvent) {
    let anyClosed = false;
    for (const stream of table.listenerStreams) {
        if (stream.isDone()) {
            anyClosed = true;
            continue;
        }
        stream.receive(evt);
    }

    if (anyClosed)
        table.listenerStreams = table.listenerStreams.filter(s => !s.isDone());
}

export function listWithAttr(schema: Schema, funcName: string, attr: string, table: Table, args: any[]) {
    const index = table.indexes.get(attr);

    if (!index)
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${attr}`);

    if (args.length !== 1)
        throw new Error(`(${schema.name}).${funcName} usage error: expected a single arg (indexed value)`)

    const indexedValue = args[0];

    switch (index.indexType) {
    case 'map':
        return [ index.items.get(indexedValue) ]
    case 'multimap':
        return index.items.get(indexedValue)
    }

    throw new Error(`Schema (${schema.name}) internal error: 'list' func didn't expect index type: ${index.indexType}`)
}

export function* each(table: Table) {
    switch (table.indexType) {
    case 'list':
        yield* table.items;
        return;
    case 'map':
        yield* table.items.values();
        return;
    case 'multimap':
        yield* table.items.values();
        return;
    }

    throw new Error(`Schema (${table.schema.name}) internal error: 'each' func didn't expect index type: ${table.indexType}`)
}

export function* eachWithAttr(schema: Schema, funcName: string, attr: string, table: Table, args: any[]) {
    const index = table.indexes.get(attr);

    if (!index)
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${attr}`);

    if (args.length !== 1)
        throw new Error(`(${schema.name}).${funcName} usage error: expected a single arg (indexed value)`)

    const indexedValue = args[0];

    switch (index.indexType) {
    case 'map':
        if (index.items.has(indexedValue))
            yield index.items.get(indexedValue);
        return;
    case 'multimap':
        yield* index.items.get(indexedValue)
        return;
    }

    throw new Error(`Schema (${schema.name}) internal error: 'list' func didn't expect index type: ${index.indexType}`)
}

export function deleteWithAttr(schema: Schema, funcName: string, attr: string, table: Table, args: any[]) {
    if (args.length !== 1)
        throw new Error(`(${schema.name}).insert usage error: expected a single arg (for field .${attr})`)

    for (const item of eachWithAttr(schema, 'each', attr, table, args)) {

        if (!item)
            throw new Error("null item in deleteWithAttr?")

        // Delete from each index
        for (const indexSchema of schema.indexes) {
            let index = table.indexes.get(indexSchema.name);

            switch (indexSchema.indexType) {
            case 'map': {
                if (indexSchema.attrs.length !== 1)
                    throw new Error("deleteWithAttr doesn't support index on multiple keys")

                index = index as MapIndex;

                const indexKey = item[indexSchema.attrs[0]];
                (index as MapIndex).items.delete(indexKey);
                break;
            }
            case 'multimap': { 
                if (indexSchema.attrs.length !== 1)
                    throw new Error("deleteWithAttr doesn't support index on multiple keys")
                index = index as MultiMapIndex;
                const uniqueKey = table.item_to_uniqueKey(item);
                const indexKey = item[indexSchema.attrs[0]];

                // optimization todo: if the attr is the same one that this index uses, then we can
                // just delete the entire key from the MultiMap.
                index.items.filterItemsOnKey(indexKey, item => !table.item_matches_uniqueKey(item, uniqueKey));
                break;
            }
            case 'list':
                throw new Error(`${funcName} internal error: deleteWithAttr doesn't support 'list' index`);
                break;
            case 'single_value':
                throw new Error(`${funcName} internal error: deleteWithAttr doesn't support 'single_value' index`);
            default:
                throw new Error(`${funcName} internal error: unexpected index type ${indexSchema.indexType}`);
            }
        }

        if (schema.supportsListening)
            sendToListeners(schema, table, { t: 'delete', item });
    }
}

export function deleteAll(schema: Schema, table: Table, args: any[]) {
    if (args.length !== 0)
        throw new Error("expected zero args for .deleteAll");

    for (const indexSchema of schema.indexes) {
        const index = table.indexes.get(indexSchema.name);

        switch (indexSchema.indexType) {
        case 'map':
            (index as MapIndex).items.clear();
            break;
        case 'multimap':
            (index as MultiMapIndex).items.clear();
            break;
        case 'list':
            (index as ListIndex).items.length = 0;
            break;
        case 'single_value':
            (index as SingleValueIndex).items[0] = null;
            break;
        }
    }

    if (schema.supportsListening)
        sendToListeners(schema, table, { t: 'delete', item: {} });
}

export function replaceAll(schema: Schema, table: Table, args: any[]) {
    if (args.length !== 1)
        throw new Error("expected one arg for .replaceAll: items[]");

    const items = args[0];

    deleteAll(schema, table, []);

    for (const item of items)
        table.insert(item);
}

export function count(schema: Schema, table: Table, args: any[]) {
    if (args.length !== 0)
        throw new Error("expected zero args for .count");

    switch (table.indexType) {
        case 'map':
            return table.items.size;
        case 'multimap':
            return table.items.valueCount();
        case 'list':
            return table.items.length;
        case 'single_value':
            return table.items.length;
    }

    throw new Error(`Schema (${schema.name}) internal error: `
                    +`'count' func didn't expect index type: ${table.indexType}`)
}
