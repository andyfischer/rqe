
import { Graph } from './Graph'
import { MountPoint } from './MountPoint'
import { Table } from './Table'
import { Block } from './Block'
import { queryToString, queryTupleToString } from './Query'

export function graphToString(graph: Graph, options: { reproducible?: boolean }) {
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

export function tableToString(table: Table) {
    let out: string[] = [];

    if (table.name)
        out.push(`Table ${table._name}:`);
    else
        out.push(`Table:`);

    for (const index of table.indexes) {
        out.push(`  index: (${index.attrs.join(' ')})`);
    }

    return out.join('\n');
}

export function mountPointToString(spec: MountPoint) {
    let requiredAttrs = [];
    let outputAttrs = [];

    for (const [attr, config] of spec.attrs.entries()) {
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

export function blockToString(block: Block, options: { omitHeader?: boolean } = {}) {
    const out: string[] = [];

    if (!options.omitHeader)
        out.push('Block:');

    for (let termIndex=0; termIndex < block.terms.length; termIndex++) {
        const term = block.terms[termIndex];

        if (term.comment) {
            if (out.length > 1)
                out.push('');
            out.push(`  // ${term.comment}`);
        }

        const idPrefix = term.id ? `#${term.id} ` : '';

        const inputStrs = term.inputs.map(input => {
            switch (input.t) {
                case 'local_input':
                    return `#${input.id}`
                case 'block_input':
                    return `#${input.name}`
                case 'value':
                    return valueToString(input.value);
            }
        });
        out.push(`  ${idPrefix}${term.f}(${inputStrs.join(', ')})`);
    }

    return out.join('\n');
}

export function valueToString(value: any) {
    if (!value)
        return JSON.stringify(value);

    switch (value.t) {
    case 'pipedQuery':
        return `(${queryToString(value)})`;
    case 'queryStep':
        return `(${queryTupleToString(value)})`;
    }

    return JSON.stringify(value);
}
