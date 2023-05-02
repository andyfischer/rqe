
import { Stream, StreamEvent, c_done } from '../Stream'

export class StreamProtocolValidator {
    description: string
    hasSentDone: boolean = false

    constructor(description: string) {
        this.description = description;
    }

    check(msg: StreamEvent) {
        if (this.hasSentDone) {
            const error = `Stream validation failed for (${this.description}), sent message after done: ${JSON.stringify(msg)}`;
            console.error(error);
            throw new Error(error);
        }

        if (msg.t === c_done) {
            this.hasSentDone = true;
        }
    }
}

export function wrapStreamInValidator(description: string, after: Stream): Stream {
    const before = new Stream();
    const validator = new StreamProtocolValidator(description);

    before.sendTo({
        receive(msg) {
            validator.check(msg);
            after.receive(msg);
        }
    });

    return before;
}

