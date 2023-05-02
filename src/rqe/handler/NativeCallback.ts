
import { Stream } from '../Stream'
import { recordUnhandledException } from '../Errors'
import { parseHandler } from '../parser/parseHandler';
import { Task } from '../task';

/*
 * Take a dynamic value and send it to a Stream.
 *
 * The value can be:
 *   - A plain value or object (sent as a single item)
 *   - A list (sent as a list of items)
 *   - A Table object (all items are sent into the stream)
 *   - A Stream object (piped into the result stream)
 *   - A Promise (after it's resolved, then the value is handled as above).
 *
 */
export function resolveOutputToStream(output: any, stream: Stream) {

    if (!output) {
        stream.finish();
        return;
    }

    if (output.t === 'stream') {
        output.sendTo(stream);
        return;
    }

    if (output.t === 'table') {
        for (const item of output.scan())
            stream.put(item);
        stream.finish();
        return;
    }

    if (Array.isArray(output)) {
        for (const el of output)
            stream.put(el);
        stream.finish();
        return;
    }

    if (output.then) {
        output.then(resolved => {
            resolveOutputToStream(resolved, stream);
        })
        .catch(e => {
            if (stream.closedByUpstream) {
                recordUnhandledException(e);
                return;
            }

            if ((e as any).backpressure_stop || (e as any).is_backpressure_stop) {
                // Function is deliberately being killed by a BackpressureStop exception. Not an error.
                stream.close();
                return;
            }

            // console.error(err);

            stream.putException(e);
            stream.close();
        });

        return;
    }

    stream.put(output);
    stream.finish();
}

/*
 * Execute a callback and send the result to the output Stream.
 *
 * This uses resolveOutputToStream for resolving the output value.
 * This function also catches exceptions and sends them as an error
 * into the Stream.
 */
export function callbackToStream(callback: Function, stream: Stream) {

    let output;

    try {
        output = callback();

    } catch (e) {

        if (stream.closedByUpstream) {
            recordUnhandledException(e);
            return;
        }

        if ((e as any).backpressure_stop || (e as any).is_backpressure_stop) {
            // Function is deliberately being killed by a BackpressureStop exception. Not an error.
            return;
        }

        stream.putException(e);
        stream.close();
        return;
    }

    resolveOutputToStream(output, stream);
}

export function declaredFunctionToHandler(decl: string, callback: Function) {

    const handler = parseHandler(decl);

    const params = handler.getParamAttrs();

    handler.setCallback((task: Task) => {
        const stream = new Stream();

        callbackToStream(() => {
            const args = params.map(param => task.getValue(param));
            return callback(...args);
        }, stream);

        return stream;
    });

    return handler;
}
