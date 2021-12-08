
import { Setup } from './Setup'
import { Graph } from './Graph'
import { MountPoint } from './Mounts'

interface FunctionDecl {
    name: string
    argNames: string[]
}

function getDecl(func: Function): FunctionDecl {

    if (typeof func !== 'function')
        throw new Error("expected a function: " + func);

    // some StackOverflow shit:
    const match = new RegExp('(?:'+func.name+'\\s*|^)\\s*\\((.*?)\\)')
        .exec(func.toString().replace(/\n/g, ''));

    const argNames = match[1].replace(/\/\*.*?\*\//g, '').replace(/ /g, '').split(',');

    return {
        name: func.name,
        argNames,
    }
}

export function quickMountJavascriptFunction(setup: Setup, func: Function) {

    const decl = getDecl(func)
    const name = decl.name || `anon`;

    const attrs = {};
    attrs[name] = {};

    for (const argName of decl.argNames) {
        attrs[argName] = {};
    }

    setup.mount({
        name: `quick_mount_${name}`,
        attrs,
    })
    .get(p => {
        const argValues = decl.argNames.map(name => p.get(name));
        const output = func.apply(null, argValues);

        if (output && output.then) {
            // Async
            p.async();

            return output.then(result => {
                p.put({[name]: result});
                p.done();
            });
        } else {
            // Sync
            p.put({[name]: output});
        }
    });
}

export function javascriptQuickMountIntoGraph(graph: Graph, func: Function): MountPoint {
    const existing = getGraphAssociatedData(graph, func, 'jsQuickMount');
    if (existing)
        return existing;

    const module = graph.createModule(setup => quickMountJavascriptFunction(setup, func));

    if (module.tables.length !== 1)
        throw new Error('javascriptQuickMountIntoGraph internal error: got more than one table');

    const table = module.tables[0];

    setGraphAssociatedData(graph, func, 'jsQuickMount', table);
    return table;
}

export function getGraphAssociatedData(graph: Graph, obj: any, field: string) {
    if (!obj['.arqe'])
        return null;

    const arqeData: Map<string,any> = obj['.arqe'];

    const graphData = arqeData.get(graph.graphId);
    if (!graphData)
        return null;

    return graphData.get(field);
}

export function setGraphAssociatedData(graph: Graph, obj: any, field: string, value: any) {
    obj['.arqe'] = obj['.arqe'] || new Map();

    const arqeData: Map<string,any> = obj['.arqe'];

    if (!arqeData.has(graph.graphId))
        arqeData.set(graph.graphId, new Map());

    arqeData.get(graph.graphId).set(field, value);
}
