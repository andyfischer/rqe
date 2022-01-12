
import { Setup } from '../Setup'
import { Table } from '.'
import { TableSchemaIssue } from '../Errors'
import { Step } from '../Step'
import { parseTableDecl } from '../parser'

export function mountTable(setup: Setup, table: Table) {
    
    const schema = table.schema();
    const attrs = Object.keys(schema.attrs);

    if (attrs.length === 0)
        return;

    const get = (step: Step) => {
        let filter = null;

        for (const tag of step.tags) {
            if (tag.attr && tag.value.t === 'str_value') {
                filter = filter || {};
                filter[tag.attr] = tag.value.str;
            }
        }

        const items = filter === null ? table.scan() : table.where(filter);

        for (const item of items) {
            step.put(item);
        }
    };

    setup.bind({
        attrs,
        name: schema.name || null,
        run: get,
    });

    for (const decl of schema.funcs || []) {
        const parsed = parseTableDecl(decl);
        if (parsed.t === 'parseError')
            throw new Error("Parse error: " + parsed);

        const requiredAttrs = [];
        for (const [ attr, config ] of Object.entries(parsed.attrs))
            if (config.required)
                requiredAttrs.push(attr);

        setup.mount(decl, get);
    }

    // put! point
    let attrsForPutDelete = {};

    for (const [attr, config] of Object.entries(schema.attrs)) {
        let required = true;

        if (config.generate)
            required = false;

        attrsForPutDelete[attr] = { required };
    }

    setup.table({
        attrs: {
            ...attrsForPutDelete,
            'put!': { required: true },
        },
        name: schema.name ? `${schema.name}/put!` : null,
        run: (step: Step) => {
            const item = step.queryValuesToItem();
            delete item['put!'];
            table.put(item);
        }
    });

    // delete! point
    setup.table({
        attrs: {
            ...attrsForPutDelete,
            'delete!': { required: true },
        },
        name: schema.name ? `${schema.name}/delete!` : null,
        run: (step: Step) => {
            let filter = null;

            for (const tag of step.tags) {
                if (tag.attr === "delete!")
                    continue;
                if (tag.attr && tag.value.t === 'str_value') {
                    filter = filter || {};
                    filter[tag.attr] = tag.value.str;
                }
            }

            table.delete(filter);
        }
    });
}
