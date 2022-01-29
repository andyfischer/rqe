
import { Item } from './Item'
import { Stream, PipeReceiver } from './Stream'
import { c_done, c_item } from './Enums'

export type StreamingTransformFunc = (item: Item) => Stream

interface Options {
    maxConcurrency?: number
}

export function streamingTransform(from: Stream, receiver: PipeReceiver, callback: StreamingTransformFunc, options: Options = {}) {

    let incomingHasFinished = false;
    let unfinishedStreams = 0;

    const incomingQueue = [];

    function startItem(item: Item) {
        const thisResult = callback(item);
        unfinishedStreams++;

        thisResult.sendTo({
            receive(data) {
                switch (data.t) {
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
                    receiver.receive({t:'item', item: data.item});
                    break;
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

export function aggregateMultiple(streams: Stream[], handler: (results: Item[][]) => Item[]) {
}
