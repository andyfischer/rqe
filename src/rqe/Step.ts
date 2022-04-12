
import { Graph, QueryParameters } from './Graph'
import { QueryLike, attrsToItem } from './Query'
import { Stream } from './Stream'
import { StoredQuery } from './StoredQuery'
import { PlannedQuery, PlannedStep } from './Planning'
import { Item } from './Item'
import { ErrorItem } from './Errors'
import { QueryStep } from './Query'
import { RunningQuery } from './RunningQuery'
import { unwrapTagged } from './TaggedValue'
import { QueryExecutionContext } from './Graph'
import { callPoint } from './CallPoint'
import { MountPointRef, runTableSearch } from './FindMatch'

interface ConstructorArgs {
    id?: number
    graph: Graph
    tuple: QueryStep
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
    tuple: QueryStep

    graph: Graph
    verb: string
    input: Stream
    output: Stream
    context: QueryExecutionContext

    planned: PlannedQuery
    plannedStep: PlannedStep
    running: RunningQuery

    incomingSchema: Item[]

    schemaOnly: boolean
    sawUsedMounts: MountPointRef[]

    declaredAsync: boolean
    declaredStreaming: boolean

    constructor(args: ConstructorArgs) {
        if (!args.context)
            throw new Error("missing .context");

        this.id = args.id;
        this.graph = args.graph;
        this.tuple = args.tuple;
        this.verb = args.tuple.verb;
        this.input = args.input;
        this.output = args.output;
        this.planned = args.planned;
        this.plannedStep = args.plannedStep;
        this.running = args.running;
        this.context = args.context;
    }

    has(attr: string) {
        return this.tuple.attrs[attr] !== undefined;
    }

    hasValue(attr: string) {
        return (this.tuple.attrs[attr] !== undefined
                && this.tuple.attrs[attr].value.t !== 'no_value');
    }
    
    withOutput(output: Stream): Step {
        const params = new Step(this);
        params.output = output;
        return params;
    }

    query(queryLike: QueryLike, parameters: QueryParameters = {}) {
        return this.graph.query(queryLike, parameters);
    }

    queryToItem() {
        return attrsToItem(this.tuple.attrs);
    }

    queryAsValue() {
        return attrsToItem(this.tuple.attrs);
    }

    /*
    queryValuesToItem() {
        const item: Item = {};
        for (const tag of this.tuple.tags) {
            switch (tag.value.t) {
                case 'str_value':
                    item[tag.attr] = tag.value.str;
                    break;
                case 'query':
                    item[tag.attr] = tag.value;
                    break;
                case 'item':
                    item[tag.attr] = tag.value.item;
                    break;
            }
        }

        return item;
    }
    */

    get(attr: string): string | null {
        const tval = this.getTaggedValue(attr);

        if (!tval || tval.t === 'no_value')
            throw new Error("No value for: " + attr);

        if (tval.t === 'str_value')
            return tval.str;

        throw new Error("Not a string: " + attr);
    }

    getTaggedValue(attr: string) {
        const tag = this.tuple.attrs[attr];
        return tag && tag.value;
    }

    getString(attr: string) {
        const tval = this.getTaggedValue(attr);
        if (!tval)
            throw new Error("Value not found for: " + attr);

        if (tval.t === 'str_value')
            return tval.str;

        throw new Error("Not a string value for: " + attr);
    }

    getOptional(attr: string, defaultValue: any) {
        const tag = this.tuple.attrs[attr];
        if (!tag || tag.value.t === 'no_value')
            return defaultValue;

        return unwrapTagged(tag.value);
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
        this.declaredAsync = true;
    }

    streaming() {
        this.declaredStreaming = true;
    }

    runTableSearch(tuple: QueryStep, input: Stream, output: Stream) {
        runTableSearch(this, tuple, input, output);
    }

    callMountPoint(pointRef: MountPointRef, tuple: QueryStep, input: Stream, output: Stream) {
        if (this.schemaOnly) {
            this.sawUsedMounts = this.sawUsedMounts || [];
            this.sawUsedMounts.push(pointRef);
            output.put(attrsToItem(tuple.attrs));
            output.done();
        } else {
            callPoint(this.graph, this.context, pointRef, tuple, input, output);
        }
    }
}
