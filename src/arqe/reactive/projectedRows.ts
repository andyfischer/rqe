
import { Table } from '../Table'
import { QueryLike, toQuery } from '../Query'
import { TransformQuery, LooseTransformQuery, toTransformQuery, applyTransform } from '../Transform'
import { c_item } from '../Enums'

export function linkProjectedRows(fromTable: Table, queryLike: QueryLike, toTable: Table) {

    const graph = fromTable.graph;
    const query = toQuery(queryLike, { graph, expectTransform: true });

    applyTransform(graph, fromTable.list(), query)
    .sendTo({
        receive(msg) {
            switch (msg.t) {
            case c_item:
                toTable.put(msg.item);
            }
        }
    });

    fromTable.addChangeListener(evt => {
        if (evt.verb === 'put') {
            applyTransform(graph, [evt.item], query)
            .sendTo({
                receive(msg) {
                    switch (msg.t) {
                    case c_item:
                        toTable.put(msg.item);
                    }
                }
            });
        } else if (evt.verb === 'delete') {
            applyTransform(graph, [evt.item], query)
            .sendTo({
                receive(msg) {
                    switch (msg.t) {
                    case c_item:
                        toTable.delete(msg.item);
                    }
                }
            });
        }
    });
}
