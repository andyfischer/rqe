
import { Step } from '../Step'
import { Graph } from '../Graph'
import { QueryTuple, QueryTag, tagsToItem, withVerb } from '../Query'
import { Block } from '../Block'
import { PrepareParams } from '../Planning'
import { Item, get } from '../Item'

function prepare({graph, later, tuple}: PrepareParams) {
    later.aggregate(later.input(), later.output(), (items: Item[]) => {
        return items.reverse();
    });
}

export const reverse = {
    prepare
};
