
import { Graph } from '../Graph'
import { Query, QueryLike } from '../Query'
import { Connection as PortConnection } from './PortProtocol'
import { IDSourceNumber as IDSource } from '../utils/IDSource'
import { MountSpec, MountPointSpec } from '../MountPoint'
import { Stream } from '../Stream'
import { get } from '../Item'
import { Port } from '../utils/Port'
import { UseConfig, ServeConfig, addSchemaUpdateListener, Message, QueryMessage,
    ConnectMessage, ConnectReply, StreamInputMessage } from './ProtocolCommon'

interface WebSocketServer {
    on(eventName: string, callback): void
}

export interface ServerConfig {
    graph: Graph
    use?: UseConfig
    serve?: ServeConfig
}

interface Connection {
    id: number
    port: Port<Message,Message>
    // connection: PortConnection
}

export class Server {
    graph: Graph
    config: ServerConfig
    nextConnectionId = new IDSource()
    connections = new Map<number, Connection>()
    nextStreamId = new IDSource()
    incomingInputStreams = new Map<number, Stream>()
    incomingOutputStreams = new Map<number, Stream>()

    constructor(config: ServerConfig) {
        this.config = config;
        this.graph = config.graph;
        
        if (config.use) {
            if (config.use.discoverApi)
                throw new Error("WebSocketServer does not support .discoverApi");
            if (!config.use.expectedApi)
                throw new Error("WebSocketServer requries .expectedApi");
            if (!config.use.connectionAttr)
                throw new Error("WebSocketServer requries .connectionAttr");
        }
    }

    start() {
        if (this.config.use && this.config.use.expectedApi) {
            this.graph.createModuleV2(this.config.use.expectedApi.map((point: MountPointSpec) => {
                return {
                    ...point,
                    run: (step) => {
                        const req = step.queryToItem();
                        const connectionId = get(req, this.config.use.connectionAttr);
                        const connection = this.connections.get(connectionId);
                        const input = step.input;

                        if (!connection) {
                            throw new Error("connection not found: " + connectionId);
                        }

                        const query = {
                            t: 'step',
                            attrs: {
                                ...step.tuple.attrs,
                            }
                        }

                        delete query.attrs[this.config.use.connectionAttr];

                        this.sendQueryToConnection(connection, query, input)
                        .sendTo(step.output);
                    }
                }
            }));
        }
    }

    addWebSocketConnection(ws) {

        let id;

        const port: Port = {
            onMessage: {
                addListener(callback) {
                    ws.addEventListener('send', msg => {
                        const parsed = JSON.parse(msg);
                        callback(msg);
                    });
                },
                removeListener(callback) {
                    ws.removeEventListener('send', callback);
                },
            },
            onDisconnect: {
                addListener(callback) {
                    ws.addEventListener('close', callback);
                },
                removeListener(callback) {
                    ws.removeEventListener('close', callback);
                },
            },
            postMessage: (msg) => {
                ws.send(JSON.stringify(msg));
            },
            disconnect: () => {
                ws.close();
                this.connections.delete(id);
            }
        }

        id = this.addPortConnection(port);
    }

    addPortConnection(port: Port) {
        const id = this.nextConnectionId.take();

        this.connections.set(id, { id, port });

        return id;
    }

    sendQueryToConnection(connection: Connection, query: QueryLike, input: Stream) {
        let inputId = 0;
        if (!input.isKnownEmpty()) {
            inputId = this.nextStreamId.take();

            input.sendTo({
                receive: (msg) => {
                    const socketMsg: StreamInputMessage = {
                        t: 'streamInput',
                        streamId: inputId,
                        msg
                    };
                    connection.port.postMessage(socketMsg);
                }
            });
        }

        const outputId = this.nextStreamId.take();
        const output = new Stream();
        this.incomingOutputStreams.set(outputId, output);

        const msg: QueryMessage = {
            t: 'query',
            query,
            inputId,
            outputId,
        }

        connection.port.postMessage(msg);
        return output;
    }

    onMessage(connection: Connection, message: Message) {
        switch (message.t) {
        case 'connect':
            if (!this.config.serve) {
                connection.port.postMessage({
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

            connection.port.postMessage(reply);
            return;

        case 'connectReply':
            /*
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
                                this.sendQueryToConnection(step.tuple, step.input)
                                .sendTo(step.output);
                            }
                        }
                    });

                    const module = this.graph.createModuleV2(newPoints);
                    this.modules.set(serverModuleEntry.id, module);
                }

                // this.expectingConnectCid = 0;
                // this.status = 'open';

                return;
            }
            */
            return;

        case 'updateModule':
            /*
            if (this.status === 'connecting')
                return;
            */

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
                    connection.port.postMessage({
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

    warn(s: string) {
        console.warn('WSServer: ' + s);
    }
}

export function connectServer(config: ServerConfig) {
    const connection = new Server(config);
    connection.start();
    return connection;
}

export function serverListenToWebSocket(server: Server, wsServer: any) {
    wsServer.on('connection', ws => {
        server.addWebSocketConnection(ws);
    });
}
