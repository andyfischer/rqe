
import { Graph } from '../Graph'
import { Step } from '../Step'
import { prepareTableSearch } from '../FindMatch'
import { QueryTuple, QueryTag, tagsToItem } from '../Query'
import { Block, executeBlock } from '../Block'
import { PrepareParams } from '../Planning'

function prepare({graph, later, tuple}: PrepareParams) {
    prepareTableSearch(later, graph, tuple, later.namedInput('step_input'), later.namedInput('step_output'));
}

export const get = {
    prepare,
}
