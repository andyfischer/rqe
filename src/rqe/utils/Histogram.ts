
export class Histogram<K = string> {
    values = new Map<K, number>()
    total = 0

    init(key: K) {
        if (!this.values.has(key))
            this.values.set(key, 0);
    }

    increment(key: K) {
        this.total += 1;
        if (this.values.has(key))
            this.values.set(key, this.values.get(key) + 1);
        else
            this.values.set(key, 1);
    }

    entries() {
        return this.values.entries();
    }
}
