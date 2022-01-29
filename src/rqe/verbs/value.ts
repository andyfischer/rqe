
import { Step } from '../Step'
import { Graph } from '../Graph'
import { QueryTuple, QueryTag, tagsToItem, withVerb } from '../Query'
import { Block } from '../Block'
import { PrepareParams } from '../Planning'

function prepare({graph, later, tuple}: PrepareParams) {
    later.put(later.output(), tagsToItem(tuple.tags));
    later.close_stream(later.output());
}

export const value = {
    prepare,
    runUsingBlock: true,
}
