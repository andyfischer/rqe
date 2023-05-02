
import { Table, Schema, compileSchema } from '../table'
import { Stream, StreamEvent, c_close, c_restart } from '../Stream'
import { formatItem } from '../Format'
import { callbackToStream } from '../handler/NativeCallback'
import { VerboseLogCacheActivity, VeryVerboseLogCacheActivity } from '../config'

export interface CacheRequest {
    params: any
    refreshHandler: (params: any) => any
}

export interface CacheItem {
    id?: number
    input_key: string
    cached_at: number
    expire_at: number
    params: any

    result_stream: Stream
    received_events: StreamEvent[]
    listeners: Stream[]

    refreshHandler: (params: any) => any

    live_ref_count: number
}

export type CacheTable = Table<CacheItem>

let _requestCacheSchema: Schema<CacheTable>

export function getRequestCacheSchema() {
    if (!_requestCacheSchema) {
        _requestCacheSchema = compileSchema({
            name: 'FunctionCache4',
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
        _requestCacheSchema.freeze();
    }

    return _requestCacheSchema;
}

/**
 * Fetch a cache item using the request.
 *
 * May return an existing item if one exists.
 */
export function getCacheItem(cache: CacheTable, request: CacheRequest): CacheItem {
    const input_key = formatItem(request.params);

    if (VeryVerboseLogCacheActivity)
        console.log('getCacheItem looking for: ' + input_key);

    let foundEntry = cache.get_with_input_key(input_key);

    if (foundEntry && foundEntry.expire_at) {
        if (foundEntry.expire_at < Date.now()) {
            // Existing value has expired, delete it.
            cache.delete_with_input_key(input_key);
            foundEntry = null;
        }
    }

    if (foundEntry) {
        // Found a valid existing result.
        return foundEntry;
    }

    // Need to create a new cache item
    const item: CacheItem = {
        input_key,
        cached_at: Date.now(),
        expire_at: 0,
        refreshHandler: request.refreshHandler,
        params: request.params,
        live_ref_count: 0,
        result_stream: null,
        listeners: [],
        received_events: [],
    }

    if (VerboseLogCacheActivity)
        console.log('created cache item: ', item.input_key);

    cache.insert(item);

    // Perform the request and listen to the output.
    refreshCacheItem(item);

    return item;
}

export function listenToCacheData(item: CacheItem, output: Stream) {
    for (const event of item.received_events) {
        output.receive(event);
    }

    item.listeners.push(output);
}

export function cacheItemFilterClosedStreams(item: CacheItem) {
    item.listeners = item.listeners.filter(listener => !listener.closedByDownstream);
}

function refreshCacheItem(item: CacheItem) {
    if (item.result_stream) {
        item.result_stream.closeByDownstream();
        item.result_stream = null;
    }

    const result_stream = new Stream();
    const received_events: StreamEvent[] = [];

    item.result_stream = result_stream;
    item.received_events = received_events;

    item.result_stream.sendTo({
        receive(evt) {
            if (evt.t === c_close) {
                // Don't send 'close' to listeners, they stay open.
                item.result_stream = null;
                return;
            }

            received_events.push(evt);
            let anyClosed = false;

            for (const listener of item.listeners) {
                if (listener.closedByDownstream) {
                    anyClosed = true;
                    continue;
                }

                listener.receive(evt);

                if (listener.closedByDownstream)
                    anyClosed = true;
            }

            if (anyClosed) {
                cacheItemFilterClosedStreams(item);
            }
        }
    });

    for (const listener of item.listeners)
        listener.receive({ t: c_restart });

    callbackToStream(() => item.refreshHandler(item.params), item.result_stream)
}

export function invalidateCacheItem(item: CacheItem) {
    if (VerboseLogCacheActivity)
        console.log('invalidating cache item: ', item.params);

    refreshCacheItem(item);
}

export function invalidateCacheItemsOnCondition(cache: CacheTable, condition: (item: CacheItem) => boolean) {
    for (const item of cache.each()) {
        if (condition(item)) {
            invalidateCacheItem(item);
        }
    }
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

/*
 * Helper object to manage usage of a cache-based value.
 *
 * This is optimized for use in a React hook.
 *
 * Responsibilities:
 *  - Initial item can be fetched synchronously (intended to be called in useState)
 *  - Listening is started as a separate step (intended to be started and cleaned up
 *    in useEffect)
 *  - Refresh() function will check for differences in the request data, and if it
 *    changes, then a different cache item is requested. (intended to be triggered
 *    during React render)
 */
/*
export class CacheItemHandle {
    cache: CacheTable
    currentCacheItem: CacheItem

    // Listener fields
    updateStream: Stream
    currentDataListener: Stream
    currentStatusListener: Stream

    constructor(cache: Table<CacheItem>) {
        this.cache = cache;
    }

    startListening() {
        if (this.updateStream)
            return;

        this.updateStream = new Stream();
        this._startListeningToCurrentItem();
    }

    isListening() {
        return this.updateStream != null;
    }

    refresh(req: CacheRequest) {
        if (VeryVerboseLogCacheActivity) {
            console.log('Cache refresh for: ', req);
        }

        const cacheItem = getCacheItem(this.cache, req);

        if (this.currentCacheItem && (this.currentCacheItem.id == cacheItem.id)) {
            if (VeryVerboseLogCacheActivity)
                console.log('No change on refresh for: ', { req, current: this.currentCacheItem, latest: cacheItem });
            return;
        }

        if (VeryVerboseLogCacheActivity)
            console.log('Cache item has changed on refresh for: ', req);

        if (this.isListening()) {
            this._stopListeningToCurrentItem();
        }

        this.currentCacheItem = cacheItem;

        if (this.isListening()) {
            this._startListeningToCurrentItem();
            this.updateStream.receive({ t: 'item', item: {} });
        }
    }

    close() {
        this._stopListeningToCurrentItem();
        this.updateStream.done();
        this.updateStream = null;
    }

    _stopListeningToCurrentItem() {
        if (this.currentCacheItem) {
            stopUsingCacheItem(this.cache, this.currentCacheItem);
            this.currentDataListener.closeByDownstream();
            this.currentDataListener = null;
            this.currentStatusListener.closeByDownstream();
            this.currentStatusListener = null;
            this.currentCacheItem = null;
        }
    }

    _startListeningToCurrentItem() {
        startUsingCacheItem(this.cache, this.currentCacheItem);
        this.currentDataListener = this.currentCacheItem.data.listen();
        this.currentDataListener.sendTo(this.updateStream);
        this.currentStatusListener = this.currentCacheItem.data.status.listen();
        this.currentStatusListener.sendTo(this.updateStream);
    }
}
*/
