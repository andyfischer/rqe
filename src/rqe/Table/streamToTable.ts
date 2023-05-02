
import { Table } from './Table'
import { Stream, StreamEvent, c_done, c_item, c_delete, c_error, c_restart } from '../Stream'

interface StreamSetup {
    input: Stream
    table: Table
    continuousUpdates?: boolean
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
    switch (event.t) {
    case c_item:
        table.insert(event.item);
        break;
    case c_delete:
        table.delete(event.item);
        break;
    case c_error:
        if (status.get()?.statusType !== 'error') {
            status.set({
                statusType: 'error',
                error: event.error,
            });
        }
        break;
    case c_done:
        if (status.get()?.statusType !== 'error')
            status.set({ statusType: 'done' });

        break;
    case c_restart:
        table.deleteAll();
        status.set(null);
        break;
    }
}
