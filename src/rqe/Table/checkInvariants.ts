
import { Table, TableIndex } from './Table'
import { each } from './RuntimeFunctions'

function* eachOnIndex(index: TableIndex) {
    switch (index.indexType) {
    case 'map':
    case 'multimap':
        yield* index.items.values();
        return;
    case 'list':
    case 'single_value':
        yield* index.items;
        return;
    }
}

export function checkInvariantsOnTable(table: Table) {
    const schema = table.schema;

    function error(message) {
        return new Error(`Invariant check failed (on schema: ${schema.name}): ${message}`);
    }

    // walk through the default index
    const defaultIndex = table.indexes.get(schema.defaultIndex.name);

    if (!defaultIndex)
        throw error("Primary index not found");

    const byUniqueKey = new Map();
    let defaultCount = 0;

    if (table.supportsFunc('item_to_uniqueKey')) {

        for (const item of eachOnIndex(defaultIndex)) {
            const uniqueKey = table.item_to_uniqueKey(item);
            if (!uniqueKey)
                throw error("item_to_uniqueKey returned falsy: " + uniqueKey);

            if (byUniqueKey.has(uniqueKey))
                throw error("Duplicate items for a uniqueKey: " + uniqueKey)

            byUniqueKey.set(uniqueKey, item);
            defaultCount++;
        }

        // Look up on each index and make sure we get the same items
        for (const indexSchema of schema.indexes) {
            let thisIndexCount = 0;
            for (const compareItem of eachOnIndex(table.indexes.get(indexSchema.name))) {
                const uniqueKey = table.item_to_uniqueKey(compareItem);
                if (!uniqueKey)
                    throw error("item_to_uniqueKey returned falsy: " + uniqueKey);

                if (!byUniqueKey.has(uniqueKey)) {
                    console.log('item: ', compareItem)
                    throw error(`index '${indexSchema.name}' has an item that wasn't in the default index, uniqueKey=${uniqueKey}`)
                }

                thisIndexCount++;
            }

            if (thisIndexCount !== defaultCount)
                throw error(`index '${indexSchema.name}' had a different item count than the default index (found ${thisIndexCount}, expected ${defaultCount})`)
        }
    }

    if (table.supportsFunc('each')) {
        // Validate every item from each()
        for (const item of table.each()) {
            if (item == null)
                throw error("each() saw a null value")
        }
    }
}
