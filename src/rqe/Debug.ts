
import { Graph } from './Graph'
import { MountPointSpec } from './MountPoint'
import { Table } from './Table'
import { queryToString, queryStepToString } from './Query'
import { PlannedQuery } from './Planning'
import { formatTable } from './format/TableFormatter'
import { taggedToString } from './TaggedValue'
import { EnableWarningOnUnserializableData } from './config'

declare global {
    interface Console {
      slog: typeof console.log
    }
}

console.slog = structuredConsoleLog;

export function graphToString(graph: Graph, options: { reproducible?: boolean } = {}) {
    const out: string[] = [];

    if (graph.graphId && !options.reproducible)
        out.push(`Graph ${graph.graphId || ''}:`);
    else
        out.push(`Graph:`);

    for (const module of graph.modules) {
        for (const point of module.points) {
            let str = '';

            if (point.name)
                str += `[${point.name}]`;

            str += '  ' + mountPointToString(point);

            out.push(str);
        }
    }

    return out.join('\n');
}

export function graphTablesToString(graph: Graph, options: { reproducible?: boolean } = {}) {
    const out: string[] = [];

    if (graph.graphId && !options.reproducible)
        out.push(`Graph ${graph.graphId || ''} contents:`);
    else
        out.push(`Graph contents:`);

    for (const table of graph.tables.values()) {
        out.push(`  [${table.name}]`);
        for (const line of formatTable(table)) {
            out.push('  ' + line);
        }
    }

    return out.join('\n');
}


export function tableSchemaToString(table: Table) {
    let out: string[] = [];

    if (table.name)
        out.push(`Table ${table.name}:`);
    else
        out.push(`Table:`);

    for (const index of table.indexes) {
        out.push(`  index: (${index.attrs.join(' ')})`);
    }

    return out.join('\n');
}

export function mountPointToString(spec: MountPointSpec) {
    let requiredAttrs = [];
    let outputAttrs = [];

    for (const [attr, config] of Object.entries(spec.attrs)) {
        if (config.required)
            requiredAttrs.push(attr);
        else
            outputAttrs.push(attr);
    }

    let out = '';

    if (requiredAttrs.length > 0)
        out += `${requiredAttrs.join(' ')} `;

    if (outputAttrs.length > 0) 
        out += `-> ${outputAttrs.join(' ')}`

    return out;
}

export function valueToString(value: any) {
    if (!value)
        return JSON.stringify(value);

    switch (value.t) {
    case 'pipedQuery':
        return `(${queryToString(value)})`;
    case 'queryStep':
        return `(${queryStepToString(value)})`;
    }

    return JSON.stringify(value);
}

export function planToString(plannedQuery: PlannedQuery) {
    let out = [];

    out.push("Planned query:");
    for (const step of plannedQuery.steps) {
        out.push(` [Step #${step.id}]`);
        out.push(`  tuple:   (${queryStepToString(step.tuple)})`);
        out.push(`  outputs: ${JSON.stringify(step.outputSchema)}`);
    }

    return out.join('\n');
}

export function structuredConsoleLog(...args: any[]) {
    const out = args.map(arg => {
        if (arg.t) {
            return taggedToString(arg);
        } else {
            return arg;
        }
    });

    console.log.apply(null, out);
}

export function assertDataIsSerializable(data: any) {
    if (EnableWarningOnUnserializableData) {

        // At the moment the important one to catch is Function because it will be silently ignored
        // by JSON.serialize.
        //
        // Other types that are silently ignored are Undefined (which is fine) and Symbol (not used)
        //
        // There are other possible serialization errors (like cyclic references) but these throw an
        // exception in JSON.serialize, so there's your assertion, buddy.

        if (typeof data === 'function') {
            const err = new Error("can't serialize type: function");
            err['badType'] = 'function'
            err['path'] = [];
            throw err;
        }

        if (typeof data === 'object') {
            for (const [k,v] of Object.entries(data)) {
                try {
                    assertDataIsSerializable(v);
                } catch (err) {
                    if (err['badType']) {
                        err['path'] = [k].concat(err['path']);
                        err.message = `can't serialize type: ${err['badType']} (at path: ${err['path'].join('.')})`;
                        throw err;
                    }
                }
            }
        }
    }
}
