
import { Table, Schema, compileSchema } from '../table'
import { Stream, StreamEvent, c_close, c_restart } from '../Stream'
import { formatItem } from '../Format'
import { callbackToStream } from '../handler/NativeCallback'
import { VerboseLogCacheActivity, VeryVerboseLogCacheActivity } from '../config'
import { CacheItemHandle } from './CacheItemHandle'

export type RequestParams = any

export interface CacheItem {
    id?: number
    input_key: string
    cached_at: number
    expire_at: number
    params: any

    result_stream: Stream
    received_events: StreamEvent[]
    listeners: Stream[]

    live_ref_count: number
}

export interface HandlerItem {
    id?: string
    name?: string
    scope?: string
    callback: (params: RequestParams) => void
}

export type CacheTable = Table<CacheItem>
export type HandlerTable = Table<HandlerItem>

let _requestCacheSchema: Schema<CacheTable>
let _handlerTableSchema: Schema<CacheTable>

export function getRequestCacheSchema() {
    if (!_requestCacheSchema) {
        _requestCacheSchema.freeze();
    }

    return _requestCacheSchema;
}

export function cacheItemFilterClosedStreams(item: CacheItem) {
    item.listeners = item.listeners.filter(listener => !listener.isClosed());
}

export function startUsingCacheItem(cache: CacheTable, item: CacheItem) {
    item.live_ref_count++;
}

export function stopUsingCacheItem(cache: CacheTable, item: CacheItem) {
    if (item.live_ref_count <= 0)
        return;

    item.live_ref_count -= 1;

    if (item.live_ref_count == 0) {
        if (VerboseLogCacheActivity)
            console.log('deleting cache item (unused): ', item.input_key);
        cache.delete_with_input_key(item.input_key);
    }
}

interface FunctionCacheOptions {
    items?: 'default'
    handlers?: 'default'
}

export class FunctionCache {
    items: CacheTable
    handlers: HandlerTable

    constructor(options: FunctionCacheOptions = {}) {

        let itemSchema = compileSchema({
            name: 'CacheItems',
            attrs: [
                'input_key','id auto'
            ],
            funcs: [
                'get(id)',
                'get(input_key)',
                'delete(input_key)',
                'each',
            ]
        });

        this.items = itemSchema.createTable();

        let handlerSchema = compileSchema({
            name: 'CacheHandlers',
            attrs: [
                'id auto',
                'name'
            ],
            funcs: [
                'get(id)',
                'get(name)',
                'get(scope)',
                'each',
            ]
        })

        this.handlers = handlerSchema.createTable();

        if (VerboseLogCacheActivity)
            console.log('created a new FunctionCache', this);
    }

    /**
     * Fetch a cache item using the request.
     *
     * May return an existing item if one exists.
     */
    getItem(params: RequestParams) {
        const input_key = formatItem(params);

        if (VeryVerboseLogCacheActivity)
            console.log('FunctionCache.getItem is looking for: ' + input_key);

        let foundEntry = this.items.get_with_input_key(input_key);

        if (foundEntry && foundEntry.expire_at) {
            if (foundEntry.expire_at < Date.now()) {
                // Existing value has expired, delete it.
                this.items.delete_with_input_key(input_key);
                foundEntry = null;

                if (VeryVerboseLogCacheActivity)
                    console.log('FunctionCache.getItem noticed that an existing item was expired for: ' + input_key);
            }
        }

        if (foundEntry) {

            if (VeryVerboseLogCacheActivity)
                console.log('FunctionCache.getItem found an existing valid entry: ' + input_key, { foundEntry });

            // Found a valid existing result.
            return foundEntry;
        }

        // Need to create a new cache item
        const item: CacheItem = {
            input_key,
            cached_at: Date.now(),
            expire_at: 0,
            params,
            live_ref_count: 0,
            result_stream: null,
            listeners: [],
            received_events: [],
        }

        if (VerboseLogCacheActivity)
            console.log('FunctionCache a new cache item: ' + item.input_key, item);

        this.items.insert(item);

        // Perform the request and listen to the output.
        this.refreshItem(item);

        return item;
    }

    setHandler(name: string, callback: (params: RequestParams) => any) {
        this.handlers.insert({ name, callback });
    }

    setCatchallHandler(callback: (params: RequestParams) => any) {
        const existing = this.handlers.get_with_scope('*');
        if (existing)
            throw new Error("cache already has a catch-all handler");

        this.handlers.insert({ scope: '*', callback });
    }

    findHandler(params: RequestParams): HandlerItem {
        if (params?.func) {
            const found = this.handlers.get_with_name(params.func);
            if (found)
                return found;
        }

        const catchall = this.handlers.get_with_scope('*');
        if (catchall)
            return catchall;

        return null;
    }

    refreshItem(item: CacheItem) {
        if (item.result_stream) {
            item.result_stream.closeByDownstream();
            item.result_stream = null;
        }

        const result_stream = new Stream();
        result_stream.setDownstreamMetadata({ name: 'FunctionCache calling refreshItem' });

        const received_events: StreamEvent[] = [];

        item.result_stream = result_stream;
        item.received_events = received_events;

        item.result_stream.sendTo({
            receive(evt) {
                received_events.push(evt);
                let anyClosed = false;

                for (const listener of item.listeners) {
                    if (listener.isClosed()) {
                        anyClosed = true;
                        continue;
                    }

                    listener.receive(evt);

                    if (listener.isClosed())
                        anyClosed = true;
                }

                if (anyClosed) {
                    cacheItemFilterClosedStreams(item);
                }
            }
        });

        for (const listener of item.listeners)
            listener.receive({ t: c_restart });

        const handler = this.findHandler(item.params);
        if (!handler)
            throw new Error("no handler found for: " + item.input_key)

        callbackToStream(() => handler.callback(item.params), item.result_stream)
    }

    invalidateItem(item: CacheItem) {
        console.error('fixme: invalidateItem')
    }

    invalidateWithFilter(filter: (item: CacheItem) => boolean) {
        for (const item of this.items.each()) {
            if (filter(item)) {
                this.invalidateItem(item);
            }
        }
    }

    listen(params: RequestParams, once?: boolean) {
        const item = this.getItem(params);

        return this.listenToItem(item, once);
    }

    listenToItem(item: CacheItem, once?: boolean) {
        const stream = new Stream();

        stream.setUpstreamMetadata({ name: 'FunctionCache listenToItem' });

        if (once) {
            stream.upstreamData = stream.upstreamData || {}
            stream.upstreamData.autoClose = true;
        }

        // Catch up
        for (const event of item.received_events) {
            stream.receive(event);
        }

        item.listeners.push(stream);

        return stream;
    }

    listenOnce(params: RequestParams) {
        const stream = new Stream();
        stream.setUpstreamMetadata({ name: 'FunctionCache listenOnce' });

        const item = this.getItem(params);

        for (const event of item.received_events) {
            stream.receive(event);
        }

        item.listeners.push({stream, stayOpen:true});

        return stream;
    }

    incRef(item: CacheItem) {
        startUsingCacheItem(this.items, item);
    }

    decRef(item: CacheItem) {
        stopUsingCacheItem(this.items, item);
    }

    newHandle() {
        return new CacheItemHandle(this);
    }
}
