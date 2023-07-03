
import { Port } from '../utils/Port'
import { ActiveStreamSet } from './ActiveStreamSet'
import { Stream, StreamEvent } from '../Stream'
import { RequestClient } from './RequestClient'
import { VerboseMessagePortLog } from '../config'

interface ReceiveMessage {
    t: 'receive'
    streamId: number
    evt: StreamEvent
}

interface RequestMessage<RequestType> {
    t: 'request'
    req: RequestType
    outputStreamId: number
}

type PortMessage<RequestType> = RequestMessage<RequestType> | ReceiveMessage 

class ConnectionState<OutgoingRequestType> {
    port: Port
    nextClientStreamId = 1
    clientStreams = new ActiveStreamSet()

    constructor(port: Port) {
        this.port = port;
    }

    sendRequest(req: OutgoingRequestType, output: Stream) {
        const outputId = this.nextClientStreamId;
        this.nextClientStreamId++;

        this.clientStreams.addStream(outputId, output);

        const message: RequestMessage<OutgoingRequestType> = {
            t: 'request',
            req,
            outputStreamId: outputId,
        }

        this.port.postMessage(message);

        if (VerboseMessagePortLog)
            console.log('MessagePort postMessage', message);
    }
}

interface SetupOptions<OutgoingRequestType,IncomingRequestType> {
    port: Port
    handleRequest?: (req: IncomingRequestType, connection: ConnectionState<OutgoingRequestType>, output: Stream) => void
}

export class MessagePort<OutgoingRequestType, IncomingRequestType> implements RequestClient<OutgoingRequestType> {
    port: Port
    options: SetupOptions<OutgoingRequestType,IncomingRequestType>
    serverStreams = new ActiveStreamSet()
    connection: ConnectionState<OutgoingRequestType>
    onMessage: any

    constructor(options: SetupOptions<OutgoingRequestType,IncomingRequestType>) {
        this.port = options.port;

        this.options = options;
        this.connection = new ConnectionState<OutgoingRequestType>(options.port);

        const port = options.port;
        const connection = this.connection;

        this.onMessage = (message: PortMessage<IncomingRequestType>) => {

            if (VerboseMessagePortLog)
                console.log('MessagePort received', message);

            try {
                switch (message.t) {
                case 'request':
                    if (!this.options.handleRequest) {
                        console.error("port received a request but it's not set up as a server", message);
                        return;
                    }

                    const output = this.serverStreams.startStream(message.outputStreamId);

                    output.sendTo({
                        receive(evt) {
                            const responseMsg: ReceiveMessage = {
                                t: 'receive',
                                streamId: message.outputStreamId,
                                evt,
                            };

                            port.postMessage(responseMsg);

                            if (VerboseMessagePortLog)
                                console.log('MessagePort postMessage', responseMsg);
                        }
                    });

                    options.handleRequest(message.req, connection, output);
                    break;

                case 'receive':
                    connection.clientStreams.receiveMessage(message.streamId, message.evt);
                    break;
                }
            } catch (e) {
                console.error(e);
            }
        }

        port.onMessage.addListener(this.onMessage);
    }

    close() {
        if (this.port)
            this.port.onMessage.removeListener(this.onMessage);
    }

    sendRequest(req: OutgoingRequestType, output: Stream) {
        this.connection.sendRequest(req, output);
    }
}
