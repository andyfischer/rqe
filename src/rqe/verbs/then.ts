

import { Stream, joinStreams } from '../Stream'
import { Step } from '../Step'
import { withVerb } from '../Query'
import { c_done } from '../Enums'

function run(step: Step) {
    const receivers = joinStreams(2, step.output);

    let hasLaunchedSearch = false;

    const searchTuple = withVerb(step.tuple, 'get');
    const searchInput = Stream.newEmptyStream();
    const searchOutput = Stream.newStreamToReceiver(receivers[1]);

    step.input.sendTo({
        receive(msg) {
            receivers[0].receive(msg);

            if (msg.t === c_done && !hasLaunchedSearch) {
                hasLaunchedSearch = true;
                step.runTableSearch(searchTuple, searchInput, searchOutput);
            }
        }
    });
}

export const then = {
    run,
}
