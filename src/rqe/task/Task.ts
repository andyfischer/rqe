
import { Graph } from '../graph'
import { Query } from '../query'
import { Stream, c_comment } from '../Stream'

type QueryParameters = Map<string,any>

export interface Args {
    graph: Graph
    query: Query
    input: Stream
    output: Stream
    queryParameters: QueryParameters
}

export class Task {
    graph: Graph

    input: Stream
    output: Stream

    query: Query
    queryParameters: QueryParameters

    constructor(args: Args) {
        this.graph = args.graph;
        this.query = args.query;
        this.queryParameters = args.queryParameters;
        this.input = args.input;
        this.output = args.output;
    }

    // Query accessors
    hasAttr(attr: string) {
        return this.query.hasAttr(attr);
    }

    hasValue(attr: string) {
        const tag = this.query.getAttr(attr);
        if (!tag)
            return false;

        return this.queryParameters.has(attr) || tag.hasValue();
    }

    getValue(attr: string) {
        const tag = this.query.getAttr(attr);
        if (!tag)
            return null;

        if (this.queryParameters.has(attr))
            return this.queryParameters.get(attr);

        return tag.value;
    }

    put(item: any) {
        this.output.put(item);
    }

    log(message: string, data?: any) {
        this.output.receive({ t: c_comment, message, details: { data } })
    }
}
