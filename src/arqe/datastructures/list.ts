
import { Setup } from '../Setup'
import { Step } from '../Step'
import { Table } from '../Table'
import { mountTable } from '../Table/mountTable'
import { Item } from '../Item'

interface AttrConfig {
}

export interface ListMountConfig {
    items: any[]
    attrs?: { [attr: string]: AttrConfig }
}

function getEffectiveAttrs(items: Item[]): string[] {
    const attrs = {};
    for (const item of items) {
        for (const key of Object.keys(item))
            attrs[key] = true;
    }
    return Object.keys(attrs);
}

export function setupList(setup: Setup, config: ListMountConfig) {
    const { items } = config;

    let attrs = config.attrs;

    if (!attrs) {
        attrs = {};
        for (const attr of getEffectiveAttrs(items)) {
            attrs[attr] = {};
        }
    }

    const table = new Table({ attrs });
    for (const item of config.items)
        table.put(item);

    mountTable(setup, table);
}
