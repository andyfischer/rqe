
import { Graph } from './Graph'
import { QueryTag, QueryLike } from './Query'
import { Stream } from './Stream'
import { Scope } from './Scope'
import PreparedQuery from './PreparedQuery'
import { Item } from './Item'

interface ConstructorArgs {
    graph: Graph
    scope: Scope
    tags: QueryTag[]
    verb: string
    input: Stream
    output: Stream
}

export default class Params {
    graph: Graph
    scope: Scope
    tags: QueryTag[]
    verb: string
    input: Stream
    output: Stream

    enabledAsync: boolean

    constructor(args: ConstructorArgs) {
        this.graph = args.graph;
        this.scope = args.scope;
        this.tags = args.tags;
        this.verb = args.verb;
        this.input = args.input;
        this.output = args.output;
    }

    has(attr: string) {
        for (const tag of this.tags) 
            if (tag.attr === attr)
                return true;
        return false;
    }

    hasValue(attr: string) {
        for (const tag of this.tags) 
            if (tag.attr === attr)
                return tag.value.t !== 'noValue';
        return false;
    }
    
    hasStar() {
        for (const tag of this.tags) 
            if (tag.specialAttr && tag.specialAttr.t === 'star')
                return true;
        return false;
    }

    withVerb(verb: string) {
        const params = new Params(this);
        params.verb = verb;
        return params;
    }

    withTags(tags: QueryTag[]) {
        const params = new Params(this);
        params.tags = tags;
        return params;
    }

    withInput(input: Stream): Params {
        const params = new Params(this);
        params.input = input;
        return params;
    }

    withOutput(output: Stream): Params {
        const params = new Params(this);
        params.output = output;
        return params;
    }

    dropAttr(attr: string): Params {
        return new Params({
            graph: this.graph,
            scope: this.scope,
            verb: this.verb,
            input: this.input,
            output: this.output,
            tags: this.tags.filter(tag => tag.attr !== attr),
        });
    }

    dropStar(): Params {
        return new Params({
            graph: this.graph,
            scope: this.scope,
            verb: this.verb,
            input: this.input,
            output: this.output,
            tags: this.tags.filter(tag => !(tag.specialAttr && tag.specialAttr.t === 'star')),
        });
    }

    addAttrs(attrs: string[]) {
        const tags = this.tags.slice();

        for (const attr of attrs)
            tags.push({ t: 'queryTag', attr, value: { t: 'noValue' }});

        return new Params({
            graph: this.graph,
            scope: this.scope,
            verb: this.verb,
            input: this.input,
            output: this.output,
            tags,
        });
    }

    query(queryLike: QueryLike, input?: Stream) {
        return this.graph.query(queryLike, input);
    }

    queryToItem() {
        const item: Item = {};
        for (const tag of this.tags) {
            switch (tag.value.t) {
                case 'strValue':
                    item[tag.attr] = tag.value.str;
                    break;
            }
        }

        return item;
    }

    get(attr: string) {
        for (const tag of this.tags) {
            if (tag.attr === attr) {
                if (tag.value) {
                    switch (tag.value.t) {
                    case 'strValue':
                        return tag.value.str;
                    case 'noValue':
                        throw new Error("No value for: " + attr);
                    default:
                        throw new Error('unhandled case: ' + (tag as any).value.t);
                    }
                }
            }
        }

        throw new Error("No value for: " + attr);
    }

    getPositionalAttr(index: number) {
        return this.tags[index].attr;
    }

    getOptional(attr: string, defaultValue: any) {
        for (const tag of this.tags) {
            if (tag.attr === attr) {
                if (tag.value) {
                    switch (tag.value.t) {
                    case 'strValue':
                        return tag.value.str;
                    case 'noValue':
                        return defaultValue;
                    default:
                        throw new Error('unhandled case');
                    }
                }
            }
        }

        return defaultValue;
    }

    getInt(attr: string) {
        return parseInt(this.get(attr), 10);
    }

    getOptionalInt(attr: string, defaultValue: number) {
        let value = this.getOptional(attr, defaultValue);
        return parseInt(value, 10);
    }

    putHeader(obj: Item) {
        this.output.putHeader(obj);
    }

    put(obj: Item) {
        this.output.put(obj);
    }

    callPrepared(prepared: PreparedQuery, values: { [attr: string]: any } = {}) {
        return this.graph.callPrepared(prepared, values);
    }

    done() {
        this.output.done();
    }

    async() {
        this.enabledAsync = true;
    }
}
