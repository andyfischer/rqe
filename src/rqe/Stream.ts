
import { Item } from './Item'
import { Table } from './Table/index'
import { c_done, c_item } from './Enums'
import { ErrorItem, ErrorType } from './Errors'
import { IDSourceNumber as IDSource } from './utils/IDSource'
import { streamingTransform, StreamingTransformFunc, StreamingTransformOptions } from './Concurrency'
import { StreamSuperTrace } from './config'

interface PipeItem {
    t: 'item',
    item: any
}

export interface PipeDone {
    t: 'done',
}

export interface PipeError {
    t: 'error',
    item: ErrorItem
}

export interface PipeHeader {
    t: 'header'
    item: Item
}

export interface AttrSchema {
    type?: string
}

export interface SchemaItem {
   [attr: string]: AttrSchema
}

export interface PipeSchema {
    t: 'schema'
    item: SchemaItem
}

export type TransformFunc = (item: Item) => Item | Item[]
export type AggregationFunc = (item: Item[]) => Item | Item[]

export type PipedData = PipeHeader | PipeItem | PipeDone | PipeError | PipeSchema

export interface PipeReceiver {
    receive(data: PipedData): void
}

export function joinStreams(count: number, output: Stream) {

    const receivers: Stream[] = [];
    let unfinishedCount = count;

    for (let i=0; i < count; i++) {
        receivers.push(Stream.newStreamToReceiver({
            receive(data: PipedData) {

                if (data.t === 'done') {
                    if (unfinishedCount === 0)
                        throw new Error("joinStreams got too many 'done' messages");

                    unfinishedCount--;

                    if (unfinishedCount !== 0)
                        return;
                }

                output.receive(data);
            }
        }))
    }

    return receivers;
}

export class BackpressureStop extends Error {
    backpressure_stop = true

    constructor() {
        super("Can't put to stream (backpressure stop)");
    }
}

const nextStreamId = new IDSource();

export class Stream {

    t = 'stream'
    id: number
    label?: string
    downstream: PipeReceiver
    receivedDone = false;

    // Backlog data (if the output isn't connected yet)
    _backlog: PipedData[]

    _backpressureStop: boolean

    constructor(label?: string) {
        this.label = label;
        this.id = nextStreamId.take();
    }

    isDone() {
        return this.receivedDone;
    }

    isKnownEmpty() {
        return this.receivedDone && !this.downstream && (!this._backlog || this._backlog.length === 0);
    }

    getDebugLabel() {
        let out = `#${this.id}`
        if (this.label)
            out += ` (${this.label})`;
        return out;
    }

    receive(data: PipedData) {
        if (StreamSuperTrace) {
            console.log(`Stream ${this.getDebugLabel()} received:`, data);
        }

        if (data.t !== 'done' && this._backpressureStop) {
            // console.log('throwing backpressure stop');
            throw new BackpressureStop();
        }

        if (this.receivedDone) {
            throw new Error(`Stream ${this.getDebugLabel()} received more data after 'done': ` + JSON.stringify(data))
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

    transform(output: PipeReceiver, callback: TransformFunc) {
        this.sendTo({
            receive: (msg) => {

                switch (msg.t) {
                    case c_item:

                        let result = callback(msg.item) || [];
                        if (Array.isArray(result)) {
                            for (const newItem of (result as Item[]))
                                output.receive({t: c_item, item: newItem });
                        } else { 
                            output.receive({t: c_item, item: result });
                        }


                        break;
                    default:
                        output.receive(msg);
                }
            }
        });
    }

    streamingTransform(output: Stream, callback: StreamingTransformFunc, options: StreamingTransformOptions = {}) {
        streamingTransform(this, output, callback, options);
    }

    aggregate(receiver: PipeReceiver, callback: AggregationFunc) {

        let items: Item[] = [];

        this.sendTo({
            receive: (msg) => {
                switch (msg.t) {
                    case c_item:
                        items.push(msg.item);
                        break;

                    case c_done:
                        const result = callback(items);
                        items = [];
                        for (const item of result)
                            receiver.receive({t: c_item, item });
                        receiver.receive({t: c_done});
                        break;

                    default:
                        receiver.receive(msg);
                }
            }
        });
    }

    async toTable(): Promise<Table> {
        return new Promise<Table>((resolve, reject) => {
            this.callback(table => {
                if (table.hasError())
                    reject(table.errorsToException());
                else
                    resolve(table);
            });
        });
    }

    // Use as a Promise
    then(onResolve?: (result: Table) => any, onReject?): Promise<Table> {
        let promise = this.toTable();

        if (onResolve || onReject)
            promise = promise.then(onResolve, onReject);

        return promise;
    }

    callback(callback: (table: Table) => void) {

        const result = new Table({
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
                case 'error':
                    result.putError(data.item);
                    break;
                case 'done':
                    hasCalledDone = true;
                    callback(result);
                    break;
                case 'header':
                    result.putHeader(data.item);
                    break;
                case 'schema':
                    // TODO - use this schema in the table.
                    break;
                default:
                    throw new Error("unhandled case in Stream.callback: " + (data as any).t);
                }
            }
        });
    }

    sync(opts?: {throwError?: boolean}): Table {
        let out: Table;
        const throwError = opts && opts.throwError;

        this.callback(r => { out = r });

        if (out == null)
            throw new Error("Stream didn't finish synchronously");

        if (throwError !== false)
            out.throwErrors();

        return out;
    }


    // Helper functions
    strs() {
        return this.sync().strs();
    }

    async one() {
        const table = await this.toTable();
        return table.one();
    }

    // Consume this stream as a sync iterator.
    *[Symbol.iterator]() {
        const table = this.sync();
        yield* table.scan();
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

    take() {
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

    takeItemsAndErrors() {
        if (!this.receivedDone)
            throw new Error("can't take(), stream is not yet closed");

        if (this.downstream)
            throw new Error("can't take(), stream has a downstream");

        const items = [];
        const errors = [];

        for (const data of this._backlog) {
            switch (data.t) {
                case 'item':
                    items.push(data.item);
                    break;
                case 'error':
                    errors.push(data.item);
                    break;
            }
        }

        this._backlog = [];

        return [ items, errors ];
    }

    putHeader(item: Item) {
        this.receive({ t: 'header', item });
    }

    putSchema(item: SchemaItem) {
        this.receive({ t: 'schema', item });
    }

    put(item: Item) {
        this.receive({ t: 'item', item });
    }

    putError(item: ErrorItem) {
        this.receive({ t: 'error', item });
    }

    errorAndClose(item: ErrorItem) {
        this.receive({ t: 'error', item });
        this.done();
    }

    putTableItems(table: Table) {
        for (const item of table.scan())
            this.put(item);
    }

    sendError(type: ErrorType, data?: any) {
        this.receive({ t: 'error', item: { errorType: type, ...data } });
    }

    sendUnhandledError(error: Error) {
        // console.error(error);
        this.sendError('unhandled_error', { message: error.message, stack: error.stack });
    }

    closeWithError(message: string) {
        this.receive({t: 'error', item: { errorType: 'unhandled_error', message }});
        this.receive({t: 'done'});
    }

    closeWithUnhandledError(e: Error) {
        // console.error(e);

        if (this.receivedDone) {
            console.error("Tried to close pipe with error, but pipe is already closed. Error: ", e.stack || e);
            return;
        }

        this.receive({t: 'error', item: { errorType: 'unhandled_error', message: e.message || e.toString(), stack: e.stack } });
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
        const stream = new Stream('newEmptyStream');
        stream.done();
        return stream;
    }

    static fromList(items: Item[]) {
        const stream = new Stream('fromList');
        for (const item of items)
            stream.put(item);
        stream.done();
        return stream;
    }

    static newStreamToReceiver(receiver: PipeReceiver) {
        const stream = new Stream('newStreamToReceiver');
        stream.sendTo(receiver);
        return stream;
    }
}
