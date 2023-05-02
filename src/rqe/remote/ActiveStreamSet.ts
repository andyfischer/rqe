
import { Stream, StreamEvent, c_done } from '../Stream'
import { StreamProtocolValidator } from '../validation/StreamProtocolValidator'
import { recordUnhandledException } from '../Errors'

/*
 ActiveStreamSet

 An ActiveStreamSet stores a set of open streams, each with a unique ID. The caller
 can post events directly using an ID. This class handles a bunch of common requirements:
  - Streams are deleted when done
  - Errors are caught (including the BackpressureStop exception)
  - Helper functions can bulk close all streams.

 The use case for this is when "bridging" streams across a serialization protocol like a socket.
*/

export class ActiveStreamSet {
    streams = new Map<number, Stream>();
    validators = new Map<number, StreamProtocolValidator>();
    closedStreamIds = new Set<number>()
    
    startStream(id: number) {
        if (this.streams.has(id))
            throw new Error("ActiveStreamSet protocol error: already have stream with id: " + id);

        let stream = new Stream();

        this.streams.set(id, stream);
        this.validators.set(id, new StreamProtocolValidator(`stream validator for socket id=${id}`));
        return stream;
    }

    addStream(id: number, stream: Stream) {
        if (this.streams.has(id))
            throw new Error("ActiveStreamSet protocol error: already have stream with id: " + id);

        this.streams.set(id, stream);
        this.validators.set(id, new StreamProtocolValidator(`stream validator for socket id=${id}`));
        return stream;
    }

    isStreamOpen(id: number) {
        return this.streams.has(id);
    }

    receiveMessage(id: number, msg: StreamEvent) {
        const stream = this.streams.get(id);

        if (!stream) {
            if (this.closedStreamIds.has(id))
                return;

            throw new Error("ActiveStreamSet protocol error: no stream with id: " + id);
        }

        this.validators.get(id).check(msg);

        if (msg.t === c_done) {
            this.streams.delete(id);
            this.validators.delete(id);
            this.closedStreamIds.add(id);
        }

        try {
            stream.receive(msg);
        } catch (e) {
            if (e.backpressure_stop) {
                this.streams.delete(id);
                this.validators.delete(id);
                this.closedStreamIds.add(id);
                return;
            }

            console.error("Unhandled exception in ActiveStreamSet", e);
        }
    }

    closeStream(id: number) {
        const stream = this.streams.get(id);

        if (!stream)
            return;

        this.streams.delete(id);
        this.validators.delete(id);

        stream.closeByDownstream();
    }

    closeAll() {
        for (const stream of this.streams.values()) {
            try {
                stream.closeByDownstream();
            } catch (e) {
                recordUnhandledException(e);
            }
        }

        this.streams.clear();
        this.validators.clear();
    }
}


