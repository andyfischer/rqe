
import { MemoryTable as Table } from '../MemoryTable'
import { QueryLike, toQuery } from '../Query'
import { TransformQuery, LooseTransformQuery, toTransformQuery, applyTransform } from '../Transform'

export function linkProjectedRows(fromTable: Table, queryLike: QueryLike, toTable: Table) {

    const query = toQuery(queryLike);
    const graph = fromTable.graph;

    for (const item of fromTable.scan()) {
        // PERFORMANCE TODO: Could call applyTransform in a batch here.
        for (const translatedItem of applyTransform(graph, [item], query))
            toTable.put(translatedItem);
    }

    fromTable.addChangeListener(evt => {
        if (evt.verb === 'put') {
            for (const translatedItem of applyTransform(graph, [evt.item], query)) {
                toTable.put(translatedItem);
            }
        } else if (evt.verb === 'delete') {
            for (const translatedItem of applyTransform(graph, [evt.item], query)) {
                toTable.delete(translatedItem);
            }
        }
    });
}
