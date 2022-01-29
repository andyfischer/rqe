
import { Graph } from './Graph'

export class Scope {
    graph: Graph
    env?: {
        [key: string]: any
    }

    constructor(graph: Graph) {
        this.graph = graph;
    }
}
