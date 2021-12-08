
import { Item } from './Item'
import { MemoryTable } from './MemoryTable'
import { c_done, c_item } from './Enums'

interface PipeItem {
    t: 'item',
    item: any
}

interface PipeDone {
    t: 'done',
}

export type WarningType = 'NoTableFound' | 'Unimplemented' | 'TableNotFound'
    | 'MissingAttrs' | 'MissingValue' | 'NotSupported' | 'ExtraAttrs'

export type ErrorType = 'UnhandledError'

export interface PipeWarning {
    t: 'warn',
    warningType: WarningType
    message?: string
}

export interface PipeError {
    t: 'error',
    message: string
    stack?: any
}

export interface PipeHeader {
    t: 'header'
    item: Item
}

export type PipedData = PipeHeader | PipeItem | PipeDone | PipeError | PipeWarning

export interface PipeReceiver {
    receive(data: PipedData): void
}

export function joinStreams(count: number) {

    const stream = new Stream();
    const receivers: PipeReceiver[] = [];
    let unfinishedCount = count;

    for (let i=0; i < count; i++) {
        receivers.push({
            receive(data: PipedData) {
                if (data.t === 'done') {

                    if (unfinishedCount === 0)
                        throw new Error("joinStreams got too many 'done' messages");

                    unfinishedCount--;

                    if (unfinishedCount !== 0)
                        return;
                }

                stream.receive(data);
            }
        })
    }

    return { receivers, stream };
}

export class BackpressureStop extends Error {
    backpressure_stop = true

    constructor() {
        super("Can't put to stream (backpressure stop)");
    }
}

export class Stream {

    downstream: PipeReceiver
    receivedDone = false;

    // Backlog data (if the output isn't connected yet)
    _backlog: PipedData[]

    _backpressureStop: boolean

    isDone() {
        return this.receivedDone;
    }

    receive(data: PipedData) {
        if (data.t !== 'done' && this._backpressureStop) {
            // console.log('throwing backpressure stop');
            throw new BackpressureStop();
        }

        if (this.receivedDone) {
            throw new Error("Stream received more data after 'done'")
        }

        if (data.t === 'done')
            this.receivedDone = true;

        if (this.downstream) {
            this.downstream.receive(data);
        } else {
            this._backlog = this._backlog || [];
            this._backlog.push(data);
        }
    }

    sendTo(receiver: PipeReceiver) {
        if (this.downstream)
            throw new Error("Stream already has a downstream");

        this.downstream = receiver;

        if (this._backlog) {
            // Send the pending backlog.
            const backlog = this._backlog;
            delete this._backlog;

            for (const data of backlog)
                this.downstream.receive(data);
        }
    }

    // Use as a Promise
    then(onResolve?: (result: MemoryTable) => any, onReject?): Promise<MemoryTable> {
        let promise = new Promise<MemoryTable>(resolve => this.callback(resolve));
        if (onResolve || onReject)
            promise = promise.then(onResolve, onReject);

        return promise;
    }

    callback(callback: (rel: MemoryTable) => void) {

        const result = new MemoryTable({
            name: 'QueryResult'
        });

        let hasCalledDone = false;

        this.sendTo({
            receive(data: PipedData) {
                if (hasCalledDone) {
                    throw new Error("got message after 'done': " + data.t);
                }

                switch (data.t) {
                case 'item':
                    result.put(data.item);
                    break;
                case 'warn':
                    result._warnings.push(data);
                    break;
                case 'error':
                    result._errors.push(data);
                    break;
                case 'done':
                    hasCalledDone = true;
                    callback(result);
                    break;
                case 'header':
                    // todo - do something with header
                    break;
                default:
                    throw new Error("unhandled case in Stream.callback: " + (data as any).t);
                }
            }
        });
    }

    sync(): MemoryTable {
        let out: MemoryTable;

        this.callback(r => { out = r });

        if (out === null)
            throw new Error("Stream didn't finish synchronously");

        return out;
    }
    
    // Consume this stream as an async iterator.
    async* [Symbol.asyncIterator]() {

        let incoming = [];
        let loopTrigger: () => void = null;

        // Stream listener - Pushes to 'incoming' and calls loopTrigger().
        this.sendTo({
            receive(msg) {
                incoming.push(msg);

                if (loopTrigger) // Might not have the loopTrigger callback yet if we receive something immediately.
                    loopTrigger();
            }
        });

        // Main loop - Reads from 'incoming'.
        while (true) {
            const received = incoming;
            incoming = [];
            const nextWait = new Promise<void>(r => { loopTrigger = r });

            for (const msg of received) {
                switch (msg.t) {
                case c_done:
                    return;
                case c_item:
                    yield msg.item;
                }
            }

            // Wait until stream listener calls loopTrigger()
            await nextWait;
        }
    }

    takeBacklogItems() {
        if (!this.receivedDone)
            throw new Error("can't take(), stream is not yet closed");

        if (this.downstream)
            throw new Error("can't take(), stream has a downstream");

        const items = [];

        for (const data of this._backlog) {
            switch (data.t) {
                case 'item':
                    items.push(data.item);
            }
        }
        this._backlog = [];

        return items;
    }

    putHeader(item: Item) {
        this.receive({ t: 'header', item });
    }

    put(item: Item) {
        this.receive({ t: 'item', item });
    }

    putTableItems(table: MemoryTable) {
        for (const item of table.scan())
            this.put(item);
    }

    sendWarning(type: WarningType, message?: string) {
        this.receive({ t: 'warn', warningType: type, message });
    }

    sendError(type: ErrorType, data?: any) {
        this.receive({ t: 'error', errorType: type, ...data });
    }

    sendUnhandledError(error: Error) {
        this.sendError('UnhandledError', { message: error.message, stack: error.stack });
    }

    closeWithError(message: string) {
        this.receive({t: 'error', message});
        this.receive({t: 'done'});
    }

    closeWithUnhandledError(e: Error) {
        if (this.receivedDone) {
            console.error("Tried to close pipe with error, but pipe is already closed. Error: ", e.stack || e);
            return;
        }

        this.receive({t: 'error', message: e.message || e.toString(), stack: e.stack });
        this.receive({t: 'done'});
    }

    done() {
        this.receive({t: 'done'});
    }

    sendDoneIfNeeded() {
        if (!this.receivedDone)
            this.receive({t: 'done'});
    }

    setBackpressureStop() {
        this._backpressureStop = true;
    }
    
    static newEmptyStream() {
        const stream = new Stream();
        stream.done();
        return stream;
    }

    static newStreamToReceiver(receiver: PipeReceiver) {
        const stream = new Stream();
        stream.sendTo(receiver);
        return stream;
    }
}
