
import { Table } from '../Table'
import Debounce from '../utils/Debounce'
import { applyChangeList } from './changePropogation'
import { connectDistributedTable } from './distributedTable'

export function newDebouncedTable(table: Table, delayMs: number = 0) {

    const baseSchema = table.schema();

    const schema = {
        ...baseSchema,
        name: baseSchema.name + '/debounce'
    }

    const debounced = table.graph.newTable(schema);

    connectDistributedTable({
        source: table,
        delayToSyncMs: delayMs,
        onOutgoingData(changes) {
            applyChangeList(changes, debounced);
        }
    });

    return debounced;
}
