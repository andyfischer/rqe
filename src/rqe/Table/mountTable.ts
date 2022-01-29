
import { Setup, toTableBind } from '../Setup'
import { Table } from '.'
import { TableSchemaIssue } from '../Errors'
import { Step } from '../Step'
import { parseTableDecl } from '../parser'

export interface TableMountConfig {
    readonly?: boolean
}

function mountPutAndDelete(setup: Setup, table: Table) {
    const schema = table.schema;
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

export function mountTable(setup: Setup, table: Table, opts: TableMountConfig = {}) {
    
    const schema = table.schema;
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

    // Default bind with all attrs.
    setup.bind({
        attrs,
        name: schema.name || null,
        run: get,
    });

    // Add binds for every declared func.
    for (const decl of schema.funcs || []) {
        const bind = toTableBind(decl, get);

        // Add the other attrs as possible outputs.
        for (const [ attr, config ] of Object.entries(schema.attrs)) {
            if (!bind.attrs[attr]) {
                bind.attrs[attr] = { required: false };
            }
        }

        setup.bind(bind);
    }

    if (opts.readonly === undefined || !opts.readonly)
        mountPutAndDelete(setup, table);
}
