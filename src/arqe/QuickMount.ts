
import { Setup } from './Setup'
import { Graph } from './Graph'
import { MountPoint } from './MountPoint'
import { Step } from './Step'

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

    function run(step: Step) {
        const argValues = decl.argNames.map(name => step.get(name));
        const output = func.apply(null, argValues);

        if (output && output.then) {
            // Async
            step.async();

            return output.then(result => {
                step.put({[name]: result});
                step.done();
            });
        } else {
            // Sync
            step.put({[name]: output});
        }
    }

    setup.bind({
        name: `quick_mount_${name}`,
        attrs,
        run,
    });
}

export function javascriptQuickMountIntoGraph(graph: Graph, func: Function): MountPoint {
    const existing = getMetadataForGraph(graph, func, 'jsQuickMount');
    if (existing)
        return existing;

    const module = graph.createModule(setup => quickMountJavascriptFunction(setup, func));

    if (module.points.length !== 1)
        throw new Error('javascriptQuickMountIntoGraph internal error: got more than one table');

    const point = module.points[0];
    setMetadataForGraph(graph, func, 'jsQuickMount', point);
    return point;
}

export function setObjectMetadata(obj: any, field: string, value: any) {
    obj['.arqe'] = obj['.arqe'] || new Map();

    const arqeData: Map<string,any> = obj['.arqe'];

    arqeData.set(field, value);
}

export function getObjectMetadata(obj: any, field: string) {
    if (!obj['.arqe'])
        return null;

    const arqeData: Map<string,any> = obj['.arqe'];

    return arqeData.get(field);
}

export function getMetadataForGraph(graph: Graph, obj: any, field: string) {

    const forGraph = getObjectMetadata(obj, `graph-${graph.graphId}`);

    if (!forGraph)
        return null;

    return forGraph.get(field);
}

export function setMetadataForGraph(graph: Graph, obj: any, field: string, value: any) {

    let forGraph = getObjectMetadata(obj, `graph-${graph.graphId}`);

    if (!forGraph) {
        forGraph = new Map();
        setObjectMetadata(obj, `graph-${graph.graphId}`, forGraph);
    }

    forGraph.set(field, value);
}

