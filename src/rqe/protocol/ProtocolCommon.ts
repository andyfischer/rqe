
import { Query, QueryLike } from '../Query'
import { PipedData } from '../Stream'
import { MountSpec, MountPointSpec } from '../MountPoint'
import { Graph } from '../Graph'

export interface ServeConfig {
    shouldServe: (point: MountPointSpec) => boolean
}

export interface UseConfig {
    expectedApi?: MountPointSpec[]
    discoverApi?: boolean
    connectionAttr?: string
}

export interface QueryMessage {
    t: 'query',
    query: QueryLike,
    inputId: number
    outputId: number
}

export interface StreamInputMessage {
    t: 'streamInput',
    streamId: number,
    msg: PipedData,
}

export interface StreamOutputMessage {
    t: 'streamOutput',
    streamId: number,
    msg: PipedData,
}

export interface ConnectMessage {
    t: 'connect',
    cid: number,
    discoverApi: boolean,
}

export interface ModuleEntry {
    id: any
    points: MountPointSpec[]
}

export interface ConnectReply {
    t: 'connectReply',
    modules: ModuleEntry[]
    cid: number,
}

export interface UpdateModuleMessage {
    t: 'updateModule',
    moduleId: number
    spec: MountSpec
}

export interface UsageErrorMessage {
    t: 'usageError',
    message: string
}

export type Message = ConnectMessage | ConnectReply
    | QueryMessage
    | StreamInputMessage | StreamOutputMessage | UpdateModuleMessage | UsageErrorMessage;

type OnSchemaChange = (moduleId: number, spec: MountSpec) => void

export function addSchemaUpdateListener(graph: Graph, serve: ServeConfig, onSchemaChange: OnSchemaChange) {
    graph.addSchemaListener(schemaChange => {
        if (schemaChange.verb === 'update') {
            const moduleId = schemaChange.item.id;
            const changedPoints = schemaChange.item.points;

            const updatedSpec: MountSpec = {
                points: []
            };

            for (const changedPoint of changedPoints) {
                if (serve.shouldServe(changedPoint.spec)) {
                    updatedSpec.points.push({
                        ...changedPoint.spec,
                        module: null,
                        run: null,
                    });
                }
            }

            onSchemaChange(moduleId, updatedSpec);
        }
    }, { backlog: false });
}
