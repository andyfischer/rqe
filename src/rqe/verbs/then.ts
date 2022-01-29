
import { Graph } from '../Graph'
import { Stream, joinStreams } from '../Stream'
import { Step } from '../Step'
import { prepareTableSearch } from '../FindMatch'
import { runTableSearch } from '../RunningQuery'
import { shallowCopy } from '../Item'
import { QueryTuple, QueryTag, tagsToItem, withVerb } from '../Query'
import { c_done } from '../Enums'
import { Block } from '../Block'

function prepare(graph: Graph, tuple: QueryTuple, later: Block) {
    prepareTableSearch(later, graph, tuple, later.namedInput('step_input'), later.namedInput('step_output'));
}

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
                runTableSearch(step.graph, step.context, searchTuple, searchInput, searchOutput);
            }
        }
    });
}

export const then = {
    run,
}
