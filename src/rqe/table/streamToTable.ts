
import { Table } from './Table'
import { Stream, StreamEvent, c_done, c_item, c_delete, c_error, c_restart, c_close } from '../Stream'

const VerboseLogStreamToTable = false;

export interface StreamSetup {
    input: Stream
    table: Table
    continuousUpdates?: boolean
    afterUpdate?: () => void
    afterDone?: () => void
}

export interface StreamToTableCallbacks {
    afterUpdate?: () => void
    afterDone?: () => void
}

export function streamToTable(setup: StreamSetup) {
    const { input, table, afterUpdate, afterDone } = setup;

    table.status.set({
        statusType: 'loading',
    });

    input.sendTo({
        receive(evt: StreamEvent) {
            tableReceiveStreamEvent(table, table.status, evt);

            if (afterUpdate) {
                try {
                    afterUpdate();
                } catch (e) {
                    console.error(e);
                }
            }
            
            if (afterDone && evt.t === c_done) {

                if (!setup.continuousUpdates) {
                    input.closeByDownstream();
                }

                try {
                    afterDone();
                } catch (e) {
                    console.error(e);
                }
            }
        }
    });
}

export function tableReceiveStreamEvent(table: Table, status: Table, event: StreamEvent) {
    let currentStatus = status.get()?.statusType;

    if (VerboseLogStreamToTable) {
        console.log(`streamToTable to ${table.schema.name} (currentStatus=${currentStatus}): got event:`, event);
    }

    switch (event.t) {
    case c_item:
        table.insert(event.item);
        break;
    case c_delete:
        table.delete(event.item);
        break;
    case c_error:
        if (currentStatus !== 'error') {
            status.set({
                statusType: 'error',
                error: event.error,
            });
        }
        break;
    case c_done:
        if (currentStatus !== 'error')
            status.set({ statusType: 'done' });

        break;

    case c_close: {
        switch (currentStatus) {
        case 'error':
        case 'done':
            break;
        default:
            status.set({ statusType: 'error', error: { errorMessage: 'Incomplete reply' }});
        }
        break;
    }

    case c_restart:
        table.deleteAll();
        status.set(null);
        break;
    }

    if (VerboseLogStreamToTable) {
        const newStatus = status.get()?.statusType;
        if (newStatus !== currentStatus)
            console.log(`streamToTable to ${table.schema.name}: changed status to: ${newStatus}`);
    }
}
