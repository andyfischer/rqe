
import { QueryExecutionContext } from './Graph'
import { MountPointRef } from './FindMatch'
import { Stream, BackpressureStop } from './Stream'
import { QueryStep, tupleHas, withAttrs, tupleHasStar } from './Query'
import { Graph } from './Graph'
import { Step } from './Step'
import { VerboseLogFilteredEmptyValue } from './config'

export function callPoint(graph: Graph, context: QueryExecutionContext, pointRef: MountPointRef, tuple: QueryStep, input: Stream, output: Stream) {

    const point = graph.getMountPoint(pointRef);
    if (!point)
        throw new Error("mount point ref not resolved: " + JSON.stringify(pointRef));

    if (!point.attrs)
        throw new Error("not a valid MountPoint object: " + point);

    // Add in the point's assumeInclude tags
    const assumeIncludeTags = [];

    for (const [ attr, attrConfig ] of Object.entries(point.attrs)) {
        if (attrConfig.assumeInclude && !tupleHas(tuple, attr)) {
            assumeIncludeTags.push(attr);
        }
    }

    tuple = withAttrs(tuple, assumeIncludeTags);

    let callOutput = output;

    if (!tupleHasStar(tuple)) {
        // Post filter the stream output.
        let downstream = output;

        callOutput = new Stream('post filter callMountPoint');

        callOutput.sendTo({
            receive(data) {
                if (data.t === 'item') {
                    const fixedItem: any = {};
                    let anyKeys = false;

                    for (const [key, value] of Object.entries(data.item)) {
                        if (step.has(key)) {
                            fixedItem[key] = value;
                            anyKeys = true;
                        }
                    }

                    if (!anyKeys) {
                        if (VerboseLogFilteredEmptyValue) {
                            console.slog('empty value was filtered', data.item);
                        }
                        return;
                    }

                    downstream.receive({t: 'item', item: fixedItem});

                } else {
                    downstream.receive(data);
                }
            }
        });
    }

    let step = new Step({
        graph,
        tuple,
        input,
        output: callOutput,
        context,
    });

    if (!point.callback)
        throw new Error("MountPoint has no .callback");

    try {
        let data: any = point.callback(step);

        handleCallbackOutput(step, data);

    } catch (e) {
        if ((e as BackpressureStop).backpressure_stop) {
            // Function is deliberately being killed by a BackpressureStop exception. Not an error.
            step.output.sendDoneIfNeeded();
            return;
        }

        step.output.sendUnhandledError(e);
        step.output.sendDoneIfNeeded();
        return;
    }

    // Automatically call 'done' if the call is not async.
    if (!step.declaredAsync && !step.declaredStreaming) {
        step.output.sendDoneIfNeeded();
    }
}

function handleCallbackOutput(step: Step, data: any) {
    
    if (!data)
        return;

    if (data.t === 'stream') {
        step.streaming();
        data.sendTo(step.output);
        return;
    }

    if (data.t === 'table') {
        for (const item of data.scan())
            step.put(item);
        return;
    }

    if (data.then) {

        if (!step.declaredStreaming) {
            // Implicit async
            step.async();
        }

        return data.then(data => {
            if (!data) {
                if (!step.declaredStreaming)
                    step.output.sendDoneIfNeeded();
                return;
            }

            if (data.t === 'stream') {
                step.streaming();
                data.sendTo(step.output);
            } else if (data.t === 'table') {
                for (const item of data.scan())
                    step.put(item);
            } else if (Array.isArray(data)) {
                for (const el of data)
                    step.put(el);
            } else {
                step.put(data);
            }

            if (!step.declaredStreaming)
                step.output.sendDoneIfNeeded();

        })
        .catch(e => {
            if ((e as BackpressureStop).backpressure_stop) {
                // Function is deliberately being killed by a BackpressureStop exception. Not an error.
                step.output.sendDoneIfNeeded();
                return;
            }

            console.log('error', e);

            step.output.sendUnhandledError(e);
            step.output.sendDoneIfNeeded();
            return;
        });
    }

    if (Array.isArray(data)) {
        for (const el of data)
            step.put(el);
        return;
    }

    step.put(data);
}
