
import { Item } from './Item'
import { Stream, PipeReceiver, PipedData, PipeDone } from './Stream'
import { c_done, c_item } from './Enums'
import { Table } from './Table'

export type StreamingTransformFunc = (item: Item) => Stream

export interface StreamingTransformOptions {
    maxConcurrency?: number
}

export function streamingTransform(from: Stream, receiver: PipeReceiver, callback: StreamingTransformFunc, options: StreamingTransformOptions = {}) {

    let incomingHasFinished = false;
    let unfinishedStreams = 0;

    const incomingQueue = [];

    function startItem(item: Item) {
        const thisResult = callback(item);
        unfinishedStreams++;

        thisResult.sendTo({
            receive(msg) {
                switch (msg.t) {
                case c_done:
                    // console.log('mapStreamForEachItem saw stream end');
                    unfinishedStreams--;
                    maybePopFromQueue();
                    if (incomingHasFinished && unfinishedStreams === 0) {
                        // console.log('mapStreamForEachItem done (2)');
                        receiver.receive({t: 'done'});
                    }
                    break;
                case c_item:
                    receiver.receive({t:'item', item: msg.item});
                    break;
                default:
                    receiver.receive(msg);
                }
            }
        });
    }

    function atConcurrencyLimit() {
        if (options.maxConcurrency) {
            return unfinishedStreams >= options.maxConcurrency;
        }

        return false;
    }

    function maybePopFromQueue() {
        while (incomingQueue.length > 0 && !atConcurrencyLimit()) {
            const next = incomingQueue.shift();
            startItem(next);
        }
    }

    from.sendTo({
        receive(msg) {
            switch (msg.t) {
            case c_done:
                incomingHasFinished = true;

                if (incomingHasFinished && unfinishedStreams === 0) {
                    // console.log('mapStreamForEachItem done (1)');
                    receiver.receive({t: 'done'});
                }
                
                break;
            case c_item: {
                const item = msg.item;

                if (atConcurrencyLimit()) {
                    // we're at the limit, stick it on the queue.
                    incomingQueue.push(item);
                    return;
                }

                startItem(item);
                break;
            }
            default:
                receiver.receive(msg);
                break;
            }
        }
    });
}

export function aggregateMultiple(streams: Stream[], output: Stream, onReadyHandler: (results: Table[], output: Stream) => void) {

    const progress: { result: Table }[] = [];
    let hasCalledDone = false;

    function maybeDone() {
        if (hasCalledDone)
            return;

        for (const entry of progress)
            if (entry.result === null)
                return;

        // done
        hasCalledDone = true;
        const results: Table[] = [];
        for (const entry of progress)
            results.push(entry.result);

        onReadyHandler(results, output);
    }

    for (let i = 0; i < streams.length; i++) {
        const stream = streams[i];
        const statusEntry = { result: null };
        progress.push(statusEntry);

        stream.callback(result => {
            statusEntry.result = result;
            maybeDone();
        })
    }
}

interface AggregateData {
    t: 'aggregateData'
    streamIndex: number
    msg: PipedData
}

type AggregateEvent = AggregateData | PipeDone;

export function streamingAggregate(streams: Stream[], receiver: (event: AggregateEvent) => void) {

    let waitingForDone = streams.length;

    for (let i = 0; i < streams.length; i++) {
        streams[i].sendTo({
            receive(msg) {
                try {
                    receiver({
                        t: 'aggregateData',
                        streamIndex: i,
                        msg
                    });
                } catch (err) {
                    console.error(err);
                }

                if (msg.t === 'done') {
                    waitingForDone--;

                    if (waitingForDone === 0) {
                        receiver({
                            t: 'done'
                        });
                    }
                }
            }
        });
    }
}
