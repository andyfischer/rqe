
import { declaredFunctionToHandler } from '../handler/NativeCallback';
import { Graph } from '../graph'

let _graph: Graph;

export function getGraph() {
    if (!_graph) {
        _graph = new Graph();
    }

    return _graph;
}

export function exposeFunc(decl: string, func: Function) {
    const handler = declaredFunctionToHandler(decl, func);
    getGraph().mount([ handler ]);
}
