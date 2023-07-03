
import { Stream, StreamEvent, c_done, c_close } from '../Stream'

export class StreamProtocolValidator {
    description: string
    hasSentDone: boolean = false
    hasSentClose: boolean = false

    constructor(description: string) {
        this.description = description;
    }

    check(msg: StreamEvent) {
        if (this.hasSentDone && msg.t !== c_close) {
            const error = `Stream validation failed for (${this.description}), sent non-close message after done: ${JSON.stringify(msg)}`;
            console.error(error);
            throw new Error(error);
        }

        if (this.hasSentClose) {
            const error = `Stream validation failed for (${this.description}), sent message after close: ${JSON.stringify(msg)}`;
            console.error(error);
            throw new Error(error);
        }

        if (msg.t === c_done) {
            this.hasSentDone = true;
        }

        if (msg.t === c_close) {
            this.hasSentClose = true;
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

