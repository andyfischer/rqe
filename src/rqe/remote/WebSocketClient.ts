
import { ActiveStreamSet, RequestClient } from '../remote'
import { Stream } from '../Stream'
import { VerboseSocketLog } from '../config'
import { StreamEvent } from '../Stream'

export type StatusEnum = 'connecting' | 'connected' | 'disconnected'

interface WebSocket {
    addEventListener(name: string, callback: any): void
    removeEventListener(name: string, callback: any): void
    send(msg: string): void
    close(): void
    readyState: number
}

export interface RequestMessage<RequestType> {
    t: 'request'
    req: RequestType
    outputStreamId: number
}

export interface ReceiveMessage {
    t: 'receive'
    streamId: number
    evt: StreamEvent
}

export type ProtocolMessage<RequestType> = RequestMessage<RequestType> | ReceiveMessage

interface ConnectionState {}

export interface SetupOptions<OutgoingType, IncomingType> {
    socket: WebSocket
    handleRequest?: (req: IncomingType, connection: ConnectionState, output: Stream) => void
    onDisconnect?: (connection: ConnectionState) => void
    onStatusChange?: (status: StatusEnum) => void
}

export class WebSocketClientConnection<OutgoingType, IncomingType> implements RequestClient<OutgoingType> {
    options: SetupOptions<OutgoingType,IncomingType>

    incomingStreams = new ActiveStreamSet()
    nextClientStreamId = 1
    outgoingStreams = new ActiveStreamSet()
    status: Stream
    ws: WebSocket

    outgoingQueue: RequestMessage<OutgoingType>[] = []

    constructor(options: SetupOptions<OutgoingType,IncomingType>) {
        this.status = new Stream()
        this.options = options;
        this.ws = options.socket;

        const ws = options.socket;

        const connectionState: ConnectionState = {}

        if (this.options.onStatusChange) {
            this.options.onStatusChange('connecting');
        }

        ws.addEventListener('open', evt => {
            if (this.options.onStatusChange) {
                this.options.onStatusChange('connected');
            }
            
            try {
                // Flush outgoing queue
                const outgoing = this.outgoingQueue;
                this.outgoingQueue = [];

                for (const message of outgoing) {
                    // todo: catch error here and close the stream on error?
                    this.ws.send(JSON.stringify(message));
                }
            } catch (e) {
                this.status.putException(e, { 
                    errorLayer: 'WebSocketClient'
                });
            }
        });

        ws.addEventListener('close', evt => {
            this.outgoingQueue = [];
            this.incomingStreams.closeAll();
            this.outgoingStreams.closeAll();

            if (this.options.onDisconnect) {
                this.options.onDisconnect(connectionState);
            }

            if (this.options.onStatusChange) {
                this.options.onStatusChange('disconnected');
            }
        });

        ws.addEventListener('error', evt => {
            this.status.putException(evt, {
                errorLayer: 'WebSocketClient'
            });
        });


        ws.addEventListener('message', evt => {
            const message: ProtocolMessage<IncomingType> = JSON.parse(evt.data);

            if (VerboseSocketLog) {
                console.log('WS server receive:', message);
            }

            switch (message.t) {
            case 'request':
                if (!this.options.handleRequest) {
                    this.status.putError({ errorMessage: "port received a request but it's not set up as a server" });
                    return;
                }
                if (!message.req) {
                    this.status.putError({ errorMessage: "port received a bad message: missing .req" });
                    return;
                }

                const output = this.outgoingStreams.startStream(message.outputStreamId);

                output.sendTo({
                    receive(evt) {
                        const responseMsg: ReceiveMessage = {
                            t: 'receive',
                            streamId: message.outputStreamId,
                            evt,
                        };

                        if (VerboseSocketLog) {
                            console.log('WS client sending message:', responseMsg);
                        }

                        ws.send(JSON.stringify(responseMsg));
                    }
                });

                this.options.handleRequest(message.req, connectionState, output);
                break;
            case 'receive':
                this.incomingStreams.receiveMessage(message.streamId, message.evt);
                break;
            default:
                this.status.comment("WebSocketClientConnection got unexpected message", 'warn', { message });
            }
        });
    }

    isPending() {
        return this.ws?.readyState === 0;
    }

    isReady() {
        return this.ws?.readyState === 1;
    }

    isClosed() {
        return this.ws?.readyState === 3;
    }

    close() {
        this.ws.close();
        this.incomingStreams.closeAll();
        this.outgoingStreams.closeAll();
    }

    sendRequest(req: OutgoingType, output: Stream) {
        if (this.isClosed()) {
            output.closeWithError({ errorType: 'socket_connection_closed' });
            return;
        }

        const outputId = this.nextClientStreamId;
        this.nextClientStreamId++;

        this.incomingStreams.addStream(outputId, output);

        const outgoingData: RequestMessage<OutgoingType> = {
            t: 'request',
            req,
            outputStreamId: outputId,
        }

        if (this.isPending()) {
            this.outgoingQueue.push(outgoingData);
            return;
        }

        // todo: catch error here and close the stream on error?
        this.ws.send(JSON.stringify(outgoingData));
    }
}
