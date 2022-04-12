
export class MultiMap<K,V> {
    items = new Map<K, Array<V>>()

    add(key: K, item: V) {
        if (!this.items.has(key))
            this.items.set(key, []);
        this.items.get(key).push(item);
    }

    get(key: K): Array<V> {
        return this.items.get(key) || [];
    }
}
