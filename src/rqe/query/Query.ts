
export type QueryNode = MultistepQuery | Query | QueryTag
export type TagValue = string | QueryNode | null

export class MultistepQuery {
    t: 'multistep' = 'multistep'
    steps: Query[]

    constructor(steps: Query[]) {
        this.steps = steps
    }
}

export class Query {
    t: 'query' = 'query'
    tags: QueryTag[]
    tagsByAttr: Map<string, QueryTag>

    constructor(tags: QueryTag[]) {
        this.tags = tags;
        this._refresh();
    }

    freeze() {
        // TODO
    }

    withoutFirstTag() {
        return new Query(this.tags.slice(1));
    }

    hasAttr(attr: string) {
        return this.tagsByAttr.has(attr);
    }

    hasValue(attr: string) {
        const tag = this.getAttr(attr);
        return tag && tag.hasValue();
    }

    getAttr(attr: string) {
        return this.tagsByAttr.get(attr);
    }

    getPositionalAttr(index: number) {
        return this.tags[index]?.attr;
    }

    toQueryString() {
        const out = [];

        for (const tag of this.tags) {
            out.push(tag.toQueryString());
        }

        return out.join(' ');
    }

    toItemValue() {
        const item: any = {};
        for (const tag of this.tags) {
            item[tag.attr] = tag.value;
        }

        return item;
    }

    _refresh() {
        this.tagsByAttr = new Map<string, QueryTag>()
        for (const tag of this.tags)
            this.tagsByAttr.set(tag.attr, tag);
    }
}

export class QueryTag {
    t: 'tag' = 'tag'
    attr: string
    value: TagValue
    isValueOptional: boolean
    isAttrOptional: boolean
    isParameter: boolean

    constructor(attr?: string, value?: TagValue) {
        this.t = 'tag'
        if (attr)
            this.attr = attr;

        if (value != null)
            this.value = value || null
    }

    hasValue() {
        return this.value != null;
    }

    isQuery() {
        return (this.value as any)?.t === 'query';
    }
    
    toQueryString() {
        let attr = this.attr;

        if (attr === '*')
            return '*';

        let out = '';

        /*
        if (this.identifier) {
            if (this.identifier === attr)
                out += '$'
            else
                out += `[$${this.identifier}] `
        }
        */

        out += attr;

        if (this.isAttrOptional)
            out += '?';

        if (this.hasValue()) {
            out += `=`;
            out += this.value;
        }

        return out;
    }
}
