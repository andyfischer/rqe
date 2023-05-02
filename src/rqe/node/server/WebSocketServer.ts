
import WebSocket from 'ws'
import { IDSource } from '../../utils/IDSource'
import { VerboseSocketLog } from '../../config'
import { Stream } from '../../Stream'
import { ActiveStreamSet } from '../../remote/ActiveStreamSet'
import { Table } from '../../table'
import { RequestMessage, ReceiveMessage, ProtocolMessage } from '../../web/WebSocketClient'

interface ServerOptions<RequestType> {
    wsServer: any
    onConnection?: (connection: WebSocketServerConnection<any>, httpUpgradeRequest?: any) => void
    onClose?: (connection: WebSocketServerConnection<any>) => void
    handleRequest: (req: RequestType, connection: WebSocketServerConnection<RequestType>, output: Stream) => void
    activeConnections?: Table
}

export class WebSocketServerConnection<RequestType = any> {
    ws: WebSocket
    appData: any = {}
    server: WebSocketServer<any>
    requestUrl: string
    serverStreams = new ActiveStreamSet()
    clientStreams = new ActiveStreamSet()
    connectionId: number
    nextClientStreamId = 1

    constructor(server: WebSocketServer<RequestType>, ws: any, upgradeReq: any, id: number) {
        this.server = server;
        this.ws = ws;
        this.connectionId = id;
        this.requestUrl = upgradeReq.url;

        const handleRequest = server.options.handleRequest;

        ws.addEventListener('message', evt => {
            const message: ProtocolMessage<RequestType> = JSON.parse(evt.data);

            if (VerboseSocketLog) {
                console.log('WS server received message:', message);
            }

            switch (message.t) {
            case 'request':
                const output = this.serverStreams.startStream(message.outputStreamId);

                output.sendTo({
                    receive(evt) {
                        const responseMsg: ReceiveMessage = {
                            t: 'receive',
                            streamId: message.outputStreamId,
                            evt,
                        };

                        if (VerboseSocketLog) {
                            console.log('WS server sending message:', responseMsg);
                        }

                        ws.send(JSON.stringify(responseMsg));
                    }
                });

                handleRequest(message.req, this, output);
                break;
            case 'receive':
                this.clientStreams.receiveMessage(message.streamId, message.evt);
                break;
            default:
                console.warn("warning: WebSocketServerConnection got unexpected message" , message);
            }
        });
    }

    sendRequest(request: RequestType) {
        const outputId = this.nextClientStreamId;
        this.nextClientStreamId++;

        const output = this.clientStreams.startStream(outputId);

        this.ws.send(JSON.stringify({
            t: 'request',
            req: request,
            outputStreamId: outputId,
        } as RequestMessage<RequestType>))

        return output;
    }
}

export class WebSocketServer<RequestType> {
    options: ServerOptions<RequestType>
    nextConnectionId = new IDSource()
    activeConnections = new Map<number, WebSocketServerConnection<RequestType>>();

    constructor(options: ServerOptions<RequestType>) {
        this.options = options;

        options.wsServer.on('connection', (ws, upgradeReq) => {
            this.setupConnection(ws, upgradeReq);
        });
    }

    close() {
        for (const [id, socketConnection] of this.activeConnections.entries()) {
            socketConnection.ws.close();
        }

        this.activeConnections.clear();
        this.options.wsServer.close();
    }

    setupConnection(ws, upgradeReq) {
        const connectionId = this.nextConnectionId.take();
        const connection = new WebSocketServerConnection(this, ws, upgradeReq, connectionId);
        this.activeConnections.set(connectionId, connection);

        ws.addEventListener('close', () => {
            this.activeConnections.delete(connectionId);

            if (this.options.activeConnections)
                this.options.activeConnections.delete_with_connectionId(connectionId);

            if (this.options.onClose) {
                try {
                    this.options.onClose(connection);
                } catch (e) {
                    console.error(e);
                }
            }
        });
        
        if (this.options.activeConnections)
            this.options.activeConnections.insert({ connectionId, connection });

        if (this.options.onConnection) {
            try {
                this.options.onConnection(connection, upgradeReq);
            } catch (e) {
                console.error(e);
            }
        }
    }
}

interface QuickStartOptions<RequestType> {
    port: number
    onConnection?: (connection: WebSocketServerConnection<any>) => void
    onClose?: (connection: WebSocketServerConnection<any>) => void
    handleRequest: (req: RequestType, connection: WebSocketServerConnection<RequestType>, output: Stream) => void
    activeConnections?: Table
}

export function quickStartWebServer<RequestType>({ port, activeConnections, handleRequest, onConnection }: QuickStartOptions<RequestType>) {

    const wsServer = new WebSocket.Server({
        port,
    });

    const connection = new WebSocketServer({
        wsServer,
        activeConnections,
        handleRequest,
        onConnection,
    });

    return { wsServer, connection }
}
