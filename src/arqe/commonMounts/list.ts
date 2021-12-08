
import { Setup } from '../Setup'
import Params from '../Params'
import { MemoryTable } from '../MemoryTable'
import { mountTable } from '../MemoryTable/mountTable'
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

export function mountList(setup: Setup, config: ListMountConfig) {
    const { items } = config;

    let attrs = config.attrs;

    if (!attrs) {
        attrs = {};
        for (const attr of getEffectiveAttrs(items)) {
            attrs[attr] = {};
        }
    }

    const table = new MemoryTable({ attrs });
    for (const item of config.items)
        table.put(item);

    mountTable(setup, table);
}
