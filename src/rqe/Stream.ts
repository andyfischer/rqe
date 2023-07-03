
import { toException, ErrorItem } from './Errors'
import { captureException, ErrorContext } from './Errors'
import { openAsyncIterator } from './utils/openAsyncIterator'
import { StreamSuperTrace, StreamSuperDuperTrace } from './config'
import { IDSource } from './utils/IDSource'


/*
 * Stream2 goals (versus stream 1)
 *
 * Separate message for 'items_done' versus 'close'.
 *
 * No graph. Less extra stuff.
 *
 * No forceClose (any close needs to be either from upstream or downstream)
 *
 * Clean up the live updating events. No 'patch_mode'
 *
 * Improve the error event.
 */

export const c_item = 'item';
export const c_close = 'close';
export const c_restart = 'items_restart';
export const c_done = 'items_done';
export const c_error = 'error';
export const c_header = 'header';
export const c_related = 'related';
export const c_comment = 'comment';
export const c_schema = 'schema';
export const c_delete = 'delete';
export const c_info = 'info';
export const c_warn = 'warn';

export type LogLevel = typeof c_info | typeof c_warn

export interface StreamItem<ItemType = any> { t: typeof c_item, item: ItemType }
export interface StreamClose { t: typeof c_close }
export interface StreamError { t: typeof c_error, error: ErrorItem, }
export interface StreamHeader { t: typeof c_header, comment?: string }
export interface StreamSchema { t: typeof c_schema, item: any }
export interface StreamRestart { t: typeof c_restart }
export interface StreamRelatedItem { t: typeof c_related, item: any }
export interface StreamComment { t: typeof c_comment, message: string, level?: LogLevel, details?: any }
export interface StreamDone { t: typeof c_done }
export interface StreamDelete { t: typeof c_delete, item: any }

export type StreamEvent<ItemType = any> = StreamSchema | StreamItem<ItemType> | StreamError
    | StreamRelatedItem | StreamComment
    | StreamClose | StreamHeader
    | StreamRestart | StreamDone | StreamDelete 

export interface StreamReceiver<ItemType = any> {
    receive(event: StreamEvent<ItemType>): void
}

export type StreamReceiverCallback<ItemType = any> = (event: StreamEvent<ItemType>) => void

export type LooseStreamReceiver<ItemType = any> = StreamReceiver<ItemType> | StreamReceiverCallback<ItemType>

export interface DebugMetadata {
    name: string
}

const _globalID = new IDSource()

export class Stream<ItemType = any> implements StreamReceiver {
    t = 'stream'
    globalId: number = _globalID.take()
    receiver: StreamReceiver = null
    closedByUpstream = false;
    closedByDownstream = false;
    upstreamData?: any
    upstreamMetadata?: { name: string }
    downstreamMetadata?: { name: string }

    // Backlog data (if the output isn't connected yet)
    backlog: StreamEvent[] = []

    isStream() {
        return true;
    }

    isClosed() {
        return this.closedByUpstream || this.closedByDownstream;
    }

    hasDownstream() {
        return !!this.receiver;
    }

    _sendToReceiver(event: StreamEvent) {
        try {
            this.receiver.receive(event);
        } catch (e) {
            if (e['backpressure_stop'] || e['is_backpressure_stop']) {
                this.closeByDownstream();

                return;
            }

            throw e;
        }
    }

    receive(event: StreamEvent) {
        if (this.closedByDownstream)
            throw new BackpressureStop();

        if ((event as any).t === 'done') {
            // Back compatibility with Stream v1
            this.receive({t: c_done });
            this.receive({t: c_close });
            return;
        }

        if (StreamSuperTrace || StreamSuperDuperTrace) {
            console.log(`${this.getDebugLabel()} received:`, event);

            if (StreamSuperDuperTrace) {
                const trace = ((new Error()).stack + '').replace(/^Error:/, '');
                console.log('at: ' + trace);
            }
        }

        // Check for 'close' event.
        switch (event.t) {
        case c_close:
            if (this.closedByUpstream)
                throw new ProtocolError(`${this.getDebugLabel()} Got a duplicate 'close' event`);

            this.closedByUpstream = true;
            break;
        }

        if (this.receiver) {
            this._sendToReceiver(event);
            
        } else if (this.backlog) {
            this.backlog.push(event);
        }

        if (this.closedByUpstream)
            // Help garbage collection
            this.receiver = null;
    }

    sendTo(receiver: LooseStreamReceiver) {
        if (typeof receiver === 'function')
            receiver = { receive: receiver };

        if (this.hasDownstream())
            throw new UsageError(`${this.getDebugLabel()} already has a receiver`);

        if (!receiver.receive)
            throw new UsageError("invalid StreamReceiver, missing .receive")

        this.receiver = receiver;

        if (StreamSuperTrace) {
            console.log(`${this.getDebugLabel()} is now sending to:`,
                        (receiver as any).getDebugLabel ? (receiver as any).getDebugLabel() : 'anonymous receiver');
        }

        if (this.backlog) {
            // Send the pending backlog.
            const backlog = this.backlog;
            delete this.backlog;

            for (const event of backlog) {
                this._sendToReceiver(event);
            }
        }
    }

    collectEvents(callback: (events: StreamEvent[]) => void) {
        let events: StreamEvent[] = [];

        this.sendTo({
            receive(msg: StreamEvent) {
                if (events === null)
                    return;

                if (events)
                    events.push(msg);

                if (events !== null && msg.t === c_done || msg.t === c_close) {
                    callback(events);

                    events = null;
                    callback = null;
                    return;
                }
            }
        });
    }

    collectEventsSync(): StreamEvent[] {
        let events: StreamEvent[] = null;

        this.collectEvents(_events => { events = _events });

        if (events === null)
            throw new UsageError(`${this.getDebugLabel()} did not finish synchronously`);

        return events;
    }

    collectItemsSync(): ItemType[] {
        const items: ItemType[] = [];
        for (const event of this.collectEventsSync()) {
            switch (event.t) {
                case c_error:
                    throw toException(event.error);
                case c_item:
                    items.push(event.item);
            }
        }
        return items;
    }

    collectOneItemSync(): ItemType {
        const items = this.collectItemsSync();
        if (items.length === 0)
            throw new Error(`collectOneItemSync on ${this.getDebugLabel()}: Stream did not return any items`);
        return items[0];
    }

    promiseEvents() {
        return new Promise<StreamEvent[]>((resolve, reject) => {
            this.collectEvents(resolve);
        });
    }

    // Promise that waits for the stream to finish. Any errors will be thrown.
    // Returns a list of output items.
    promiseItems() {
        return new Promise<ItemType[]>((resolve, reject) => {
            let items: ItemType[] = [];

            this.sendTo({
                receive(msg: StreamEvent) {
                    switch (msg.t) {
                    case c_item:
                        items.push(msg.item)
                        break;
                    case c_done:
                    case c_close:
                        if (items !== null)
                            resolve(items);
                        items = null;
                        break;
                    case c_error:
                        reject(toException(msg.error));
                        break;
                    }
                }
            });
        });
    }
    
    // Promise that waits for the stream to finish. Any errors will be thrown.
    // Ignores output items.
    wait() {
        return new Promise<void>((resolve, reject) => {
            this.sendTo({
                receive(msg: StreamEvent) {

                    if (msg.t === c_done) {
                        resolve();
                    } else if (msg.t === c_error) {
                        reject(toException(msg.error));
                    }
                }
            });
        });
    }

    async promiseOneItem(): Promise<ItemType> {
        const items = await this.promiseItems();
        if (items.length === 0)
            throw new Error(`promiseOneItem on ${this.getDebugLabel()}: Stream did not return any items`);
        return items[0];
    }

    // Consume this stream as a sync iterator.
    *[Symbol.iterator]() {
        yield* this.collectItemsSync();
    }
    
    // Consume this stream as an async iterator.
    async* [Symbol.asyncIterator](): AsyncIterableIterator<ItemType> {

        const { send, iterator } = openAsyncIterator<StreamEvent<ItemType>>();

        this.sendTo({ receive: send });

        for await (const evt of iterator) {
            switch (evt.t) {
            case c_done:
            case c_close:
                return;
            case c_item:
                yield evt.item;
                break;
            case c_error:
                throw toException(evt.error);
            }
        }
    }

    takeBacklog(): StreamEvent[] {
        if (this.receiver) {
            throw new UsageError(`takeBacklog on ${this.getDebugLabel()}, stream has a receiver`);
        }

        const items = this.backlog;
        this.backlog = [];
        return items;
    }

    // Helper functions to put events
    put(item: ItemType) { this.receive({ t: c_item, item }); }
    putRelated(item: any) { this.receive({ t: c_related, item }); }
    putDone() { this.receive({ t: c_done }); }
    putRestart() { this.receive({ t: c_restart }); }
    putError(error: ErrorItem) { this.receive({ t: c_error, error }); }

    putException(err: Error, context?: ErrorContext) {
        this.receive({ t: c_error, error: captureException(err, context) });
    }

    closeWithException(err: Error, context?: ErrorContext) {
        this.putException(err, context);
        this.close();
    }

    comment(message: string, level?: LogLevel, details?: any) {
        this.receive({ t: c_comment, message, level, details });
    }

    done() {
        this.receive({t: c_done});
    }

    close() {
        this.receive({t: c_close});
    }

    closeWithError(error: ErrorItem) {
        this.receive({t: c_error, error});
        this.receive({t: c_close});
    }

    finish() {
        this.receive({t: c_done});
        this.receive({t: c_close});
    }

    spyEvents(callback: (evt: StreamEvent<ItemType>) => void): Stream<ItemType> {
        const output = new Stream<ItemType>();

        this.sendTo({
            receive(evt) {
                callback(evt);
                output.receive(evt);
            }
        });

        return output;
    }

    transform<OutputType = ItemType>(callback: (item: ItemType) => OutputType): Stream<OutputType> {
        const output = new Stream<OutputType>();

        this.sendTo({
            receive(evt) {
                switch (evt.t) {
                    case c_item:
                        try {
                            const transformed = callback(evt.item);
                            output.put(transformed);
                        } catch (e) {
                            output.putException(e);
                        }
                        break;
                    default:
                        output.receive(evt as StreamEvent<OutputType>);
                }
            }
        });

        return output;
    }

    watchItems(callback: (ItemType) => void) {
        this.sendTo({
            receive(evt) {
                switch (evt.t) {
                    case c_item:
                        try {
                            callback(evt.item);
                        } catch (e) {
                            console.error(`${this.getDebugLabel()}: unhandled exception in Stream.watchItems: `, e);
                        }
                        break;
                    case c_error:
                        console.error(`${this.getDebugLabel()}: unhandled error in Stream.watchItems: `, evt.error);
                        break;
                }
            }
        });
    }

    spyItems(callback: (ItemType) => void) {
        return this.transform(item => {
            callback(item);
            return item;
        });
    }

    closeByDownstream() {
        if (this.closedByDownstream)
            return;

        this.closedByDownstream = true;

        this.receiver = null;

        if (this.backlog) {
            this.backlog = [];
        }
    }
    
    // Debug Metadata //

    setUpstreamMetadata(data: DebugMetadata) {
        if (this.upstreamMetadata)
            throw new UsageError("Stream already has upstreamMetadata");
        this.upstreamMetadata = data;
    }

    setDownstreamMetadata(data: DebugMetadata) {
        if (this.downstreamMetadata)
            throw new UsageError("Stream already has downstreamMetadata");
        this.downstreamMetadata = data;
    }

    getDebugLabel(): string {
        let label = `Stream #${this.globalId}`;

        let details;
        let downstreamName;
        let upstreamName;

        if (this.upstreamMetadata?.name)
            upstreamName = this.upstreamMetadata?.name;

        if (this.downstreamMetadata?.name)
            downstreamName = this.downstreamMetadata?.name;

        if (!downstreamName && !this.hasDownstream())
            downstreamName = 'backlog';

        if (downstreamName || upstreamName) {
            details = `${upstreamName} -> ${downstreamName}`
        }

        if (details)
            label += ` (${details})`

        return label;
    }

    // Static Constructors //

    static newEmptyStream() {
        const stream = new Stream();
        stream.done();
        stream.close();
        return stream;
    }

    static fromList<ItemType = any>(items: ItemType[]) {
        const stream = new Stream<ItemType>();
        for (const item of items)
            stream.put(item);
        stream.done();
        stream.close();
        return stream;
    }
}

export function isStream(value: any) {
    return value?.t === 'stream'
}

export class BackpressureStop extends Error {
    is_backpressure_stop = true

    constructor() {
        super("Can't put to stream (backpressure stop)");
    }
}

export class ProtocolError extends Error {
    is_stream_protocol_error = true

    constructor(msg: string) {
        super("Stream protocol error: " + msg);
    }
}

export class UsageError extends Error {
    is_stream_usage_error = true

    constructor(msg: string) {
        super("Stream usage error: " + msg);
    }
}
