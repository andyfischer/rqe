
import { WebSocketClientConnection } from './WebSocketClient'
import { Table, compileSchema } from '../table'
import { Stream } from '../Stream'
import { RequestClient } from '../remote'
import { StatusEnum } from './WebSocketClient'

export interface SetupOptions<OutgoingType, IncomingType> {
    getSocket: () => WebSocket
    handleRequest?: (req: IncomingType, connection, output: Stream) => void
    onStatusChange?: (status: StatusEnum) => void
}

const ReconnectionRecentWindowTime = 30;

export class ReconnectingWebSocketClient<OutgoingType, IncomingType> implements RequestClient<OutgoingType> {
    connection: WebSocketClientConnection<OutgoingType, IncomingType>
    options: SetupOptions<OutgoingType, IncomingType>
    attempts: Table
    reconnectTimer: any
    permanentClose: boolean = false

    constructor(options: SetupOptions<OutgoingType,IncomingType>) {
        this.options = options;
        this.attempts = compileSchema({
            name: 'WebSocketClientAttempts',
            attrs: [
                'id auto',
                'time',
            ],
            funcs: [
                'each',
                'delete(id)',
            ]
        }).createTable();
        this.tryReconnect();
    }

    _reconnect() {
        this.connection = null;

        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);

        if (this.permanentClose)
            return;

        let socket;

        try {
            socket = this.options.getSocket();
        } catch (err) {
            console.warn("failed to open web socket", err);
            this.attempts.insert({ time: Date.now() });
            return;
        }

        this.connection = new WebSocketClientConnection({
            handleRequest: this.options.handleRequest,
            socket,
            onStatusChange: this.options.onStatusChange,
            onDisconnect: () => {
                // console.log('onDisconnect')
                this.connection = null;
                this.tryReconnect();
            }
        });

        this.attempts.insert({ time: Date.now() });
    }

    tryReconnect() {
        /*
        if (this.connection && this.connection.isClosed()) {
            console.log('tryReconnect - connection is closed')
            this.connection = null;
        }
        */

        if (this.connection)
            return;

        if (this.permanentClose)
            return;

        const { recentCount, mostRecentAttempt } = this.countRecentReconnects();

        if (recentCount === 0) {
            this._reconnect();
            return;
        }

        // console.log(`tryReconnect: ${recentCount} recent attempts, most recent at ${new Date(mostRecentAttempt)} (${Date.now() - mostRecentAttempt} ms ago)`);

        if (recentCount >= 5) {
            // console.error('ReconnectingWebSocketClient tryReconnect - giving up');
            // Give up after 5 attempts within 1 minute
            return;
        }

        let timeToAttempt = (2 ** recentCount) * 250 + mostRecentAttempt - Date.now();

        if (timeToAttempt < 10)
            timeToAttempt = 0;

        console.log(`tryReconnect: scheduled next reattempt for ${timeToAttempt}ms`, { recentCount, mostRecentAttempt });

        if (timeToAttempt === 0)
            this._reconnect();

        this.reconnectTimer = setTimeout(() => this.tryReconnect(), timeToAttempt);
    }

    countRecentReconnects() {
        let recentCount = 0;
        let mostRecentAttempt = null;
        const now = Date.now();
        const recentWindow = ReconnectionRecentWindowTime * 1000;

        for (const item of this.attempts.each()) {
            if ((item.time + recentWindow) < now) {
                this.attempts.delete_with_id(item.id);
                continue;
            }

            if (mostRecentAttempt === null || item.time > mostRecentAttempt)
                mostRecentAttempt = item.time;

            recentCount++;
        }

        return { recentCount, mostRecentAttempt }
    }

    sendRequest(request: OutgoingType, output: Stream) {
        if (this.connection)
            return this.connection.sendRequest(request, output);
        else
            throw new Error("ReconnectingWebSocketClient.sendRequest: no connection")
    }

    close() {
        this.permanentClose = true;

        if (this.connection)
            this.connection.close();

        this.connection = null;
    }
}
