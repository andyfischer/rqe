
import { Graph } from './Graph'
import { LooseTableSchema } from './Schema'
import { MemoryTable } from './MemoryTable'

let _processGlobalGraph: Graph = null;

export function getGraph(): Graph {
    if (!_processGlobalGraph)
        _processGlobalGraph = new Graph();

    return _processGlobalGraph;
}

export function newTable<T>(schema?: LooseTableSchema) {
    return getGraph().newTable<T>(schema);
}
