
export class MultiMap<K = any, V = any> {
    items = new Map<K, Array<V>>()

    add(key: K, item: V) {
        if (!this.items.has(key))
            this.items.set(key, []);
        this.items.get(key).push(item);
    }

    has(key: K) {
        return this.items.has(key);
    }

    get(key: K): Array<V> {
        return this.items.get(key) || [];
    }

    delete(key: K) {
        return this.items.delete(key);
    }

    clear() {
        this.items.clear();
    }

    filterItemsOnKey(key: K, filter: (item: V) => boolean) {
        if (!this.items.has(key))
            return;

        let filtered = this.items.get(key).filter(filter);
        this.items.set(key, filtered);
    }

    keys() {
        return this.items.keys();
    }

    *entries() {
        for (const [key,list] of this.items.entries()) {
            if (list == null)
                continue;
            for (const item of list)
                yield [key,item]
        }
    }

    *values() {
        for (const [key,list] of this.items.entries())
            yield* list;
    }

    valueCount() {
        let count = 0;
        for (const [key,list] of this.items.entries())
            count += list.length;
        return count;
    }
}
