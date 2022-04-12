
import { Query, QueryLike } from '../Query'
import { MountSpec, MountPointSpec } from '../MountPoint'
import { Port } from '../utils/Port'
import { Graph } from '../Graph'
import { PipedData } from '../Stream'
import { Module } from '../Module'
import { randInt } from '../utils/rand'
import { Step } from '../Step'
import { IDSourceNumber as IDSource } from '../utils/IDSource'
import { Stream } from '../Stream'
import { UseConfig, ServeConfig, addSchemaUpdateListener, Message, ConnectMessage, ConnectReply } from './ProtocolCommon'

/**

PortProtocol

Code to serve queries and make queries across a Port object.

*/

export interface ConnectionConfig {
    graph: Graph
    port: Port<Message,Message>
    use?: UseConfig
    serve?: ServeConfig
}

type ConnectionStatus = 'connecting' | 'open'

export class Connection {
    config: ConnectionConfig
    hasReceivedMounts = false
    status: ConnectionStatus
    expectingConnectCid: number
    graph: Graph
    port: Port<Message, Message>
    modules = new Map<string, Module>()
    nextStreamId = new IDSource()
    incomingInputStreams = new Map<number, Stream>()
    incomingOutputStreams = new Map<number, Stream>()
    premountModule: Module
    waitingForConnect: Step[] = []
    provider_id: string

    constructor(config: ConnectionConfig) {
        this.config = config;
        this.graph = config.graph;
        this.port = config.port;
    }

    start() {
        const config = this.config;

        this.port.onMessage.addListener(msg => this.onMessage(msg));

        if (config.serve) {
            addSchemaUpdateListener(config.graph, config.serve, (moduleId, updatedSpec) => {
                this.port.postMessage({
                    t: 'updateModule',
                    moduleId,
                    spec: updatedSpec
                });
            });
        }

        if (config.use) {

            this.expectingConnectCid = randInt(1000000);
            this.status = 'connecting'

            this.port.postMessage({
                t: 'connect',
                cid: this.expectingConnectCid,
                discoverApi: config.use.discoverApi,
            });

            if (config.use.expectedApi) {
                // Load up the expected API.
                this.premountModule = this.graph.createModuleV2(
                    config.use.expectedApi.map((point: MountPointSpec) => {

                        const runWhileWaitingForConnect = (step: Step) => {
                            step.streaming();
                            this.waitingForConnect.push(step);
                        }

                        return {
                            ...point,
                            providerId: this.provider_id,
                            run: runWhileWaitingForConnect,
                        }
                    })
                );
            }
        }
    }

    onMessage(message: Message) {
        switch (message.t) {

        case 'connect':
            if (!this.config.serve) {
                this.port.postMessage({
                    t: 'usageError',
                    message: 'connection is not set up as server',
                });
                return;
            }

            const reply: ConnectReply = {
                t: 'connectReply',
                cid: message.cid,
                modules: [],
            };

            for (const module of this.graph.modules) {
                const servedPoints = [];

                for (const point of module.points) {
                    if (this.config.serve.shouldServe(point.spec)) {
                        servedPoints.push({
                            ...point.spec,
                            module: null,
                            run: null,
                        });
                    }
                }

                if (message.discoverApi) {
                    if (servedPoints.length > 0) {
                        reply.modules.push({
                            id: module.moduleId,
                            points: servedPoints,
                        });
                    }
                }
            }

            this.port.postMessage(reply);
            return;

        case 'connectReply':
            if (message.cid === this.expectingConnectCid) {

                this.provider_id = (this.graph.providers().put({
                    runQuery: (q: Query, i: Stream) => this.providerRunQuery(q,i)
                })).provider_id;

                for (const serverModuleEntry of message.modules) {
                    const newPoints = serverModuleEntry.points.map(point => {
                        return {
                            ...point,
                            providerId: this.provider_id,
                            run: (step: Step) => {
                                step.streaming();
                                this.sendQueryToServer(step.tuple, step.input)
                                .sendTo(step.output);
                            }
                        }
                    });

                    const module = this.graph.createModuleV2(newPoints);
                    this.modules.set(serverModuleEntry.id, module);
                }

                this.expectingConnectCid = 0;
                this.status = 'open';

                if (this.premountModule) {
                    this.premountModule.redefine([]);
                    this.premountModule = null;

                    // Run all the waitingForConnect Steps.
                    const waitingSteps = this.waitingForConnect;
                    this.waitingForConnect = [];

                    for (const step of waitingSteps) {
                        this.sendQueryToServer(step.tuple, step.input)
                        .sendTo(step.output);
                    }
                }
                return;
            }
            return;

        case 'updateModule':
            if (this.status === 'connecting')
                return;

            // TODO

            return;

        case 'query': {

            const parameters = {};

            if (message.inputId !== 0) {
                const stream = new Stream();
                parameters['$input'] = stream;
                this.incomingInputStreams.set(message.inputId, stream);
            }

            this.graph.query(message.query, parameters)
            .sendTo({
                receive: (msg) => {

                    this.port.postMessage({
                        t: 'streamOutput',
                        streamId: message.outputId,
                        msg
                    });
                }
            });

            return;
        }

        case 'streamInput': {
            const stream = this.incomingInputStreams.get(message.streamId);
            if (!stream) {
                this.warn("PortProtocol got message for unknown stream: " + message.streamId);
                return;
            }

            stream.receive(message.msg);

            if (message.msg.t === 'done')
                this.incomingInputStreams.delete(message.streamId);

            return;
        }

        case 'streamOutput': {
            const stream = this.incomingOutputStreams.get(message.streamId);
            if (!stream) {
                this.warn("PortProtocol got message for unknown stream: " + message.streamId);
                return;
            }

            stream.receive(message.msg);

            if (message.msg.t === 'done')
                this.incomingOutputStreams.delete(message.streamId);

            return;
        }
        }
    }

    sendQueryToServer(query: QueryLike, input: Stream): Stream {
        const outputId = this.nextStreamId.take();
        const output = new Stream();
        this.incomingOutputStreams.set(outputId, output);

        let inputId = 0;
        if (!input.isKnownEmpty()) {
            inputId = this.nextStreamId.take();
        }

        this.port.postMessage({
            t: 'query',
            query,
            outputId,
            inputId,
        });

        input.sendTo({
            receive: (msg) => {
                this.port.postMessage({
                    t: 'streamInput',
                    streamId: inputId,
                    msg,
                });
            }
        });

        return output;
    }

    providerRunQuery(query: Query, input: Stream) {
        return this.sendQueryToServer(query, input);
    }

    warn(msg: string) {
        console.warn(msg);
    }
}

export function connectPortProtocol(config: ConnectionConfig) {
    const connection = new Connection(config);
    connection.start();
    return connection;
}
