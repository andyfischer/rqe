
import { AttrSet, AttrMap, LooseAttrList, header, itemGlobalId } from '.'
import { MemoryTable } from '.'

function valueToKeyString(value: any) {
    if (value == null || value == undefined) {
        return null;
    }

    const itemHeader = header(value);

    if (itemHeader) {
        if (!itemHeader.table)
            return value + '';

        return itemGlobalId(itemHeader);
    }

    return value + '';
}

export default class TableIndex<ValueType> {
    table: MemoryTable
    attrSet: AttrSet
    attrs: string[]
    data = new Map<string, Map<any,any>>()

    constructor(table: MemoryTable, attrs: LooseAttrList) {
        this.table = table;

        if (!Array.isArray(attrs))
            attrs = [attrs];

        attrs.sort();
        this.attrs = attrs;

        this.attrSet = new Map<string, true>();
        for (const attr of attrs)
            this.attrSet.set(attr, true);
    }

    toKey(attrs: Map<string, any>) {
        let key = [];

        for (const attr of this.attrs) {
            const value = attrs.get(attr);
            key.push(valueToKeyString(value));
        }

        return key.join(',');
    }

    *get(attrs: AttrMap) {
        const key = this.toKey(attrs);
        const bucket = this.data.get(key);
        if (!bucket)
            return;

        yield* this.data.get(key).values();
    }

    getOne(attrs: AttrMap) {
        for (const item of this.get(attrs))
            return item;
        return null;
    }

    insert(tableInternalKey: number, attrs: AttrMap, value: ValueType) {
        const key = this.toKey(attrs);
        let bucket = this.data.get(key);
        if (!bucket) {
            bucket = new Map();
            this.data.set(key, bucket);
        }

        bucket.set(tableInternalKey, value);
    }

    remove(tableInternalKey: number, attrs: AttrMap, value: any) {
        const key = this.toKey(attrs);
        let bucket = this.data.get(key);
        if (!bucket)
            return;

        bucket.delete(tableInternalKey);
        
        if (bucket.size === 0)
            this.data.delete(key);
    }

    coversAttrs(attrs: Map<string,true>) {
        for (const requiredAttr of this.attrs) {
            if (!attrs.has(requiredAttr))
                return false;
        }
        return true;
    }

    matchesAttrList(attrs: string[]) {
        if (this.attrs.length !== attrs.length)
            return false;

        for (const attr of attrs)
            if (!this.attrSet.has(attr))
                return false;

        return true;
    }

    coversSingleAttribute(attr: string) {
        return (this.attrs.length === 1 && this.attrs[0] === attr)
    }
}
