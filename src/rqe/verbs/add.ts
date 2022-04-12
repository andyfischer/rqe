

import { Stream } from '../Stream'
import { Step } from '../Step'
import { withVerb } from '../Query'
import { joinStreams } from '../Stream'

function run(step: Step) {

    const getTuple = withVerb(step.tuple, 'get');

    const receivers = joinStreams(2, step.output);
    const inputReceiver = receivers[0];
    step.input.sendTo(inputReceiver);

    const searchReceiver = receivers[1];

    step.runTableSearch(getTuple, Stream.newEmptyStream(), searchReceiver);
}

export const add = {
    run
}
