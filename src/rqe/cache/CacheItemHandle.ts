import { Stream } from "../Stream";
import { Table } from '../table'
import { CacheRequest, CacheItem, getCacheItem, startUsingCacheItem, stopUsingCacheItem, CacheTable } from "./FunctionCache";
import { VeryVerboseLogCacheActivity } from '../config'

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
        this.currentDataListener = new Stream();
        this.currentDataListener.sendTo(this.updateStream);
    }
}

