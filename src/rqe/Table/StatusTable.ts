
import { compileSchema } from './compileSchema'
import { Schema } from './Schema'
import { Table } from './Table'
import { StreamEvent } from '../Stream'

export interface StatusTableItem {
    statusType: 'loading'
    isDuringPatch: boolean
    pendingPatchEvents: StreamEvent[]
}

let _schema: Schema;

export function getStatusTableSchema() {
    if (!_schema) {
        _schema = compileSchema({
            name: 'TableStatus',
            funcs: [
                'get',
                'listen',
            ]
        })
    }

    return _schema
}

export function initializeNewTableWithStatus(tableProxy: Table, tableObject: Table) {

    const statusTable = getStatusTableSchema().createTable();

    tableObject.status = statusTable;

    tableObject.isLoading = () => {
        return statusTable.get().statusType === 'loading'
    }

    tableObject.hasError = () => {
        return statusTable.get().statusType === 'error';
    }

    tableObject.waitForData = () => {
        let resolve;
        const promise = new Promise<void>((r) => resolve = r);
        const listenerStream = statusTable.listen();

        listenerStream.sendTo({
            receive: (msg) => {
                if (!tableObject.isLoading()) {
                    listenerStream.closeByDownstream();
                    resolve();
                }
            }
        });

        return promise;
    }
}
