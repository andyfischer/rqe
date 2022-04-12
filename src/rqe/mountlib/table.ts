
import { toTableBind, toMountSpec } from '../Setup'
import { Table } from '../Table'
import { Step } from '../Step'
import { MountPointSpec } from '../MountPoint'
import { QueryStep } from '../Query'
import { updateItemUsingQuery } from '../Update'

export interface TableMountConfig {
    readonly?: boolean
    namespace?: string[]
}

export function getTableMount(table: Table, opts: TableMountConfig = {}): MountPointSpec[] {
    
    const schema = table.schema;
    const attrs = Object.keys(schema.attrs);
    const readonly = !!opts.readonly;
    
    if (attrs.length === 0)
        return [];

    let commonAttrs = {};

    for (const [attr, config] of Object.entries(schema.attrs)) {
        let required = config.required;

        if (config.generate)
            required = false;

        commonAttrs[attr] = { required };
    }

    const getHandler = (step: Step) => {

        let filter = null;

        for (const [ attr, details ] of Object.entries(step.tuple.attrs)) {
            if (attr && details.value.t === 'str_value') {
                filter = filter || {};
                filter[attr] = details.value.str;
            }
        }

        const items = filter === null ? table.scan() : table.where(filter);

        for (const item of items) {
            step.put(item);
        }
    };

    function updateBinding(basedOn: MountPointSpec) {
        return {
            attrs: {
                ...basedOn.attrs,
                'update!': { required: true },
            },
            run: (step: Step) => {

                let filter = null;
                const updateBody = step.tuple.attrs['update!'].value as QueryStep;

                for (const [ attr, details ] of Object.entries(step.tuple.attrs)) {
                    if (attr === "update!")
                        continue;
                    if (attr && details.value.t === 'str_value') {
                        filter = filter || {};
                        filter[attr] = details.value.str;
                    }
                }

                table.update(filter, item => {
                    updateItemUsingQuery(step.graph, item, updateBody);
                });
            }
        }
    }

    function deleteBinding(basedOn: MountPointSpec) {
        return {
            attrs: {
                ...basedOn.attrs,
                'delete!': { required: true },
            },
            run: (step: Step) => {
                let filter = null;

                for (const [ attr, details ] of Object.entries(step.tuple.attrs)) {
                    if (attr === "delete!")
                        continue;
                    if (attr && details.value.t === 'str_value') {
                        filter = filter || {};
                        filter[attr] = details.value.str;
                    }
                }

                table.delete(filter);
            }
        };
    }

    const points: MountPointSpec[] = [];

    // Default bind(s) with all attrs.
    const defaultGet = toMountSpec({
        attrs,
        name: schema.name || null,
        run: getHandler,
    });

    points.push(defaultGet);

    if (!readonly) {
      // put!
      const put: MountPointSpec = {
        attrs: {
            ...commonAttrs,
            'put!': { required: true },
        },
        run: (step: Step) => {
            const item = step.queryToItem();
            delete item['put!'];
            table.put(item);
        }
      };

      points.push(put);
      points.push(updateBinding(defaultGet));
      points.push(deleteBinding(defaultGet));
    }

    // Add binds for every declared func.
    for (const decl of schema.funcs || []) {
        const bind = toTableBind(decl, getHandler);

        // Add the other attrs as possible outputs.
        for (const [ attr, config ] of Object.entries(schema.attrs)) {
            if (!bind.attrs[attr]) {
                bind.attrs[attr] = { required: false };
            }
        }

        points.push(bind);

        if (!readonly) {
            points.push(updateBinding(bind));
            points.push(deleteBinding(bind));
        }
    }

    if (opts.namespace) {
        for (const attr of opts.namespace)
            for (const point of points)
                point.attrs[attr] = { required: true }
    }

    return points;
}
