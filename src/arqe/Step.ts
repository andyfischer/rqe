
import { Graph } from './Graph'
import { QueryTag, QueryLike, tagsToItem } from './Query'
import { Stream } from './Stream'
import { StoredQuery } from './StoredQuery'
import { PlannedQuery, PlannedStep } from './PlannedQuery'
import { Item } from './Item'
import { ErrorItem } from './Errors'
import { QueryTuple } from './Query'
import { RunningQuery } from './RunningQuery'
import { unwrapTagged } from './TaggedValue'
import { QueryExecutionContext } from './Graph'

interface ConstructorArgs {
    id?: number
    graph: Graph
    tuple: QueryTuple
    input: Stream
    output: Stream
    context: QueryExecutionContext
    planned?: PlannedQuery
    plannedStep?: PlannedStep
    running?: RunningQuery
}

export class Step {

    // id (unique within the PreparedQuery)
    id: number
    tuple: QueryTuple

    graph: Graph
    tags: QueryTag[]
    verb: string
    input: Stream
    output: Stream
    context: QueryExecutionContext

    planned: PlannedQuery
    plannedStep: PlannedStep
    running: RunningQuery

    enabledAsync: boolean

    constructor(args: ConstructorArgs) {
        if (!args.context)
            throw new Error("missing .context");

        this.id = args.id;
        this.graph = args.graph;
        this.tuple = args.tuple;
        this.tags = args.tuple.tags;
        this.verb = args.tuple.verb;
        this.input = args.input;
        this.output = args.output;
        this.planned = args.planned;
        this.plannedStep = args.plannedStep;
        this.running = args.running;
        this.context = args.context;
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
                return tag.value.t !== 'no_value';
        return false;
    }
    
    hasStar() {
        for (const tag of this.tags) 
            if (tag.specialAttr && tag.specialAttr.t === 'star')
                return true;
        return false;
    }

    withVerb(verb: string) {
        const tuple: QueryTuple = {
            t: 'queryStep',
            verb,
            tags: this.tuple.tags
        };
        return new Step({
            ...this,
            tuple
        });
    }

    withTags(tags: QueryTag[]) {
        const tuple: QueryTuple = {
            t: 'queryStep',
            verb: this.tuple.verb,
            tags,
        };
        return new Step({
            ...this,
            tuple
        });
    }

    withInput(input: Stream): Step {
        const params = new Step(this);
        params.input = input;
        return params;
    }

    withOutput(output: Stream): Step {
        const params = new Step(this);
        params.output = output;
        return params;
    }

    dropAttr(attr: string): Step {
        const tuple: QueryTuple = {
            t: 'queryStep',
            verb: this.tuple.verb,
            tags: this.tuple.tags.filter(tag => tag.attr !== attr)
        };

        return new Step({
            graph: this.graph,
            input: this.input,
            output: this.output,
            planned: this.planned,
            plannedStep: this.plannedStep,
            running: this.running,
            context: this.context,
            tuple,
        });
    }

    dropStar(): Step {
        const tuple: QueryTuple = {
            t: 'queryStep',
            verb: this.tuple.verb,
            tags: this.tuple.tags.filter(tag => !(tag.specialAttr && tag.specialAttr.t === 'star')),
        };

        return new Step({
            graph: this.graph,
            input: this.input,
            output: this.output,
            planned: this.planned,
            plannedStep: this.plannedStep,
            running: this.running,
            context: this.context,
            tuple,
        });
    }

    addAttrs(attrs: string[]) {
        const tags = this.tags.slice();

        for (const attr of attrs)
            tags.push({ t: 'tag', attr, value: { t: 'no_value' }});

        const tuple: QueryTuple = {
            t: 'queryStep',
            verb: this.tuple.verb,
            tags,
        };

        return new Step({
            graph: this.graph,
            input: this.input,
            output: this.output,
            planned: this.planned,
            plannedStep: this.plannedStep,
            running: this.running,
            context: this.context,
            tuple,
        });
    }

    query(queryLike: QueryLike, input?: Stream) {
        return this.graph.query(queryLike, input);
    }

    queryToItem() {
        return tagsToItem(this.tags);
    }

    queryAsValue() {
        return tagsToItem(this.tags);
    }

    queryValuesToItem() {
        const item: Item = {};
        for (const tag of this.tuple.tags) {
            switch (tag.value.t) {
                case 'str_value':
                    item[tag.attr] = tag.value.str;
                    break;
                case 'query_value':
                    item[tag.attr] = tag.value.query;
                    break;
                case 'item':
                    item[tag.attr] = tag.value.item;
                    break;
            }
        }

        return item;
    }

    get(attr: string): string | null {
        const tval = this.getTaggedValue(attr);

        if (!tval || tval.t === 'no_value')
            throw new Error("No value for: " + attr);

        if (tval.t === 'str_value')
            return tval.str;

        throw new Error("Not a string: " + attr);
    }

    getTaggedValue(attr: string) {
        for (const tag of this.tags)
            if (tag.attr === attr)
                return tag.value;

        return null;
    }

    getString(attr: string) {
        const tval = this.getTaggedValue(attr);
        if (!tval)
            throw new Error("Value not found for: " + attr);

        if (tval.t === 'str_value')
            return tval.str;

        throw new Error("Not a string value for: " + attr);
    }

    getPositionalAttr(index: number) {
        return this.tags[index].attr;
    }

    getOptional(attr: string, defaultValue: any) {
        for (const tag of this.tags) {
            if (tag.attr === attr) {
                if (tag.value) {
                    switch (tag.value.t) {
                    case 'str_value':
                        return tag.value.str;
                    case 'no_value':
                        return defaultValue;
                    case 'query_value':
                        return tag.value.query;
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

    getEnv(attr: string) {
        if (!this.context || !this.context.env)
            return null;

        const val = this.context.env[attr];
        if (val == null)
            return null;

        return val;
    }

    putHeader(obj: Item) {
        this.output.putHeader(obj);
    }

    put(obj: Item) {
        this.output.put(obj);
    }

    putError(obj: ErrorItem) {
        this.output.putError(obj);
    }

    callPrepared(stored: StoredQuery, values: { [attr: string]: any } = {}) {
        return this.graph.callPrepared(stored, values);
    }

    done() {
        this.output.done();
    }

    async() {
        this.enabledAsync = true;
    }
}
