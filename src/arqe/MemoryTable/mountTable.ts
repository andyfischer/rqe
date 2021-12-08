
import { Setup } from '../Setup'
import { MemoryTable } from '.'
import { TableSchemaIssue } from '../Errors'
import Params from '../Params'

export function mountTable(setup: Setup, table: MemoryTable) {
    
    const schema = table.schema();
    const attrs = Object.keys(schema.attrs);

    if (attrs.length === 0)
        throw new TableSchemaIssue(table, "can't mount without any attr definitions");

    setup.table({
        attrs,
        name: schema.name || null,
    })
    .get((params: Params) => {
        let filter = null;

        for (const tag of params.tags) {
            if (tag.attr && tag.value.t === 'strValue') {
                filter = filter || {};
                filter[tag.attr] = tag.value.str;
            }
        }

        const items = filter === null ? table.scan() : table.where(filter);

        for (const item of items) {
            params.put(item);
        }
    });

    setup.table({
        attrs: attrs.concat(['put']),
        name: schema.name ? `${schema.name}/put` : null,
    })
    .get((params: Params) => {
        const item = params.queryToItem();
        delete item['put'];
        table.put(item);
    });
}
