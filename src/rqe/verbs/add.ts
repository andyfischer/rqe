
import { Graph } from '../Graph'
import { Stream } from '../Stream'
import { Step } from '../Step'
import { prepareTableSearch } from '../FindMatch'
import { shallowCopy } from '../Item'
import { QueryTuple, QueryTag, tagsToItem, withVerb, queryTupleToString } from '../Query'
import { Block } from '../Block'
import { PrepareParams } from '../Planning'

function prepare({graph, later, tuple}: PrepareParams) {

    const receivers = later.join_streams(2, later.namedInput('step_output'));
    const inputReceiver = later.get_index(receivers, 0);
    later.send_to(later.namedInput('step_input'), inputReceiver);

    const searchReceiver = later.get_index(receivers, 1);
    const getTuple = withVerb(tuple, 'get');

    prepareTableSearch(later, graph, getTuple, later.new_stream(), searchReceiver);
}

export const add = {
    prepare,
}
