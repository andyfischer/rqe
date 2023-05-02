
import { toException, ErrorItem } from './Errors'
import { captureException, ErrorContext } from './Errors'
import { openAsyncIterator } from './utils/openAsyncIterator'
import { StreamSuperTrace, StreamSuperDuperTrace } from './config'

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

export class Stream<ItemType = any> implements StreamReceiver {
    t = 'stream'
    label?: string
    receiver: StreamReceiver = null
    closedByUpstream = false;
    closedByDownstream = false;

    // Backlog data (if the output isn't connected yet)
    backlog: StreamEvent[] = []

    constructor(label?: string) {
        this.label = label;
    }

    isStream() {
        return true;
    }

    isDone() {
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
            console.log(`Stream ${this.label} received:`, event);

            if (StreamSuperDuperTrace) {
                const trace = ((new Error()).stack + '').replace(/^Error:/, '');
                console.log('at: ' + trace);
            }
        }

        switch (event.t) {
        case c_close:
            if (this.closedByUpstream)
                throw new ProtocolError("Got a duplicate 'close' event");

            this.closedByUpstream = true;
            break;
        }

        if (this.receiver) {
            this._sendToReceiver(event);
            
        } else {
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
            throw new UsageError("Stream already has a receiver");

        if (!receiver.receive)
            throw new UsageError("invalid StreamReceiver, missing .receive")

        this.receiver = receiver;

        if (StreamSuperTrace) {
            console.log(`Stream ${this.label} is now sending to:`,
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
                if (msg.t === c_done) {
                    callback(events);

                    events = null;
                    callback = null;
                    return;
                }

                events.push(msg);
            }
        });
    }

    collectEventsSync(): StreamEvent[] {
        let events: StreamEvent[] = null;

        this.collectEvents(_events => { events = _events });

        if (events === null)
            throw new UsageError("Stream did not finish synchronously");

        return events;
    }

    promiseEvents() {
        return new Promise<StreamEvent[]>((resolve, reject) => {
            this.collectEvents(resolve);
        });
    }

    promiseItems() {
        return new Promise<ItemType[]>((resolve, reject) => {
            let items: ItemType[] = [];

            this.sendTo({
                receive(msg: StreamEvent) {

                    if (msg.t === c_item) {
                        items.push(msg.item)
                    } else if (msg.t === c_done) {
                        resolve(items);
                        items = null;
                    } else if (msg.t === c_error) {
                        reject(toException(msg.error));
                    }
                }
            });
        });
    }

    // Consume this stream as a sync iterator.
    *[Symbol.iterator]() {
        yield* this.collectEventsSync();
    }
    
    // Consume this stream as an async iterator.
    async* [Symbol.asyncIterator]() {

        const { send, iterator } = openAsyncIterator();

        this.sendTo({ receive: send });

        for await (const evt of iterator) {
            switch (evt.t) {
            case c_done:
                return;
            case c_item:
                yield evt.item;
                break;
            case c_error:
                throw toException(evt.item);
            }
        }
    }

    takeBacklog(): StreamEvent[] {
        if (this.receiver)
            throw new UsageError("can't call takeBacklog, stream has a receiver");

        const items = this.backlog;
        this.backlog = [];
        return items;
    }

    // Helper functions to put events
    put(item: ItemType) {
        this.receive({ t: c_item, item });
    }

    putRelated(item: any) {
        this.receive({ t: c_related, item });
    }

    putError(error: ErrorItem) {
        this.receive({ t: c_error, error });
    }

    putException(err: Error, context?: ErrorContext) {
        this.receive({ t: c_error, error: captureException(err, context) });
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

    closeByDownstream() {
        if (this.closedByDownstream)
            return;

        this.closedByDownstream = true;

        this.receiver = null;
        if (this.backlog) {
            this.backlog = [];
        }
    }

    static newEmptyStream(label?: string) {
        const stream = new Stream(label);
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

export function isPromise(value: any) {
    return !!(value?.then);
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
