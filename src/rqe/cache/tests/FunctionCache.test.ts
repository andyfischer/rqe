import { getRequestCacheSchema, CacheTable, getCacheItem, listenToCacheData, startUsingCacheItem, stopUsingCacheItem } from '../FunctionCache';
import { Stream } from '../../Stream';
import { it, expect } from '../../test'

function newCache() {
    return getRequestCacheSchema().addFuncs(['count']).createTable();
}

  it('returns a new cache item if not found in cache', () => {
      const cache = newCache();
    const request = { params: { foo: 'bar' }, refreshHandler: () => {} };
    const item = getCacheItem(cache, request);
    expect(item.params).toEqual(request.params);
    expect(item.refreshHandler).toEqual(request.refreshHandler);
  });

  it('returns an existing cache item if found in cache', () => {
      const cache = newCache();
    const request = { params: { foo: 'bar' }, refreshHandler: () => {} };
    const item1 = getCacheItem(cache, request);
    const item2 = getCacheItem(cache, request);
    expect(item2).toBe(item1);
  });

  it('startUsingCacheItem/stopUsingCacheItem updates ref counts', () => {
      const cache = newCache();
    const request = { params: { foo: 'bar' }, refreshHandler: () => {} };
    const item = getCacheItem(cache, request);
    const output = new Stream();
    startUsingCacheItem(cache, item);
    expect(item.live_ref_count).toBe(1);
    stopUsingCacheItem(cache, item);
    expect(item.live_ref_count).toBe(0);
  });
