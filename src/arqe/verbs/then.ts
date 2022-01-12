
import { Stream, joinStreams } from '../Stream'
import { Step } from '../Step'
import { prepareTableSearch } from '../PlannedQuery'
import { runTableSearch } from '../RunningQuery'
import { shallowCopy } from '../Item'
import { QueryTag, tagsToItem } from '../Query'
import { c_done } from '../Enums'
import { Block } from '../Block'

function prepare(step: Step, block: Block) {
    for (const it of step.input)
        step.put(it);

    step.put(tagsToItem(step.tags));

    prepareTableSearch(step, block.namedInput('step'), block)
}

function run(step: Step) {
    const { receivers, stream } = joinStreams(2);
    stream.sendTo(step.output);

    let hasLaunchedSearch = false;

    const search = step
      .withVerb('get')
      .withInput(Stream.newEmptyStream())
      .withOutput(Stream.newStreamToReceiver(receivers[1]))

    step.input.sendTo({
        receive(msg) {
            receivers[0].receive(msg);

            if (msg.t === c_done && !hasLaunchedSearch) {
                hasLaunchedSearch = true;
                runTableSearch(search);
            }
        }
    });
}

export const then = {
    run,
    prepare
}
