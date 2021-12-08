
import { Item, entries, get } from '../Item'

const horizLineChar = '\u2501'
const vertLineChar = '\u2503'
const crossLineChar = '\u254b'

export interface TableFormatState {
    attrs: Map<string, {
        width: number
        highestObservedWidth: number
    }>
}

interface FormattedItem {
    cells: Map<string,string>
}

export function singleValueToString(v: any) {
    switch (typeof v) {
    case 'string':
        return v;
    case 'number':
    case 'boolean':
        return v + '';
        return v + '';
    }

    if (v == null)
        return '';

    return JSON.stringify(v);
}

export function formatItems(items: Item[]): FormattedItem[] {
    const result: FormattedItem[] = [];

    for (const item of items) {
        const cells = new Map<string,string>();

        for (const [ attr, value ] of entries(item)) {
            cells.set(attr, singleValueToString(value));
        }

        result.push({ cells });
    }

    return result;
}

export function newTableFormatState(): TableFormatState {
    return {
        attrs: new Map()
    }
}

export function updateStateForItems(state: TableFormatState, items: FormattedItem[]) {

    // Add any new attrs and update highestObservedWidth.

    for (const item of items) {
        for (const [ attr, str ] of item.cells.entries()) {

            const width = Math.max(str.length, attr.length);

            if (!state.attrs.has(attr)) {
                state.attrs.set(attr, {
                    width,
                    highestObservedWidth: width
                });
            } else {
                const attrData = state.attrs.get(attr);
                if (width > attrData.highestObservedWidth) {
                    attrData.width = width;
                    attrData.highestObservedWidth = width;
                }
            }
        }
    }

    // TODO: Rebalance if we're above the width limit.
}

function rightPadSpaces(s: string, size: number) {
    s = s || '';
    if (s.length > size)
        throw new Error(`internal error, string '${s}' is bigger than size ${size}`);

    let spaceRight = size - s.length;
    return s + ' '.repeat(spaceRight);
}

export function formatHeader(state: TableFormatState) {

    const titleEls = [];
    const titleBarEls = [];

    for (const [ attr, details ] of state.attrs.entries()) {
        const width = details.width;

        const title = rightPadSpaces(attr, width);
        titleEls.push(title);
        titleBarEls.push(horizLineChar.repeat(width));
    }

    const header = titleEls.join(` ${vertLineChar} `);

    return {
        key: header,
        print(log) {
            log(header);
            log(titleBarEls.join(`${horizLineChar}${crossLineChar}${horizLineChar}`));
        }
    }
}

export function printItems(state: TableFormatState, items: FormattedItem[], log: (s: string) => void) {
    for (const item of items) {
        const outputEls = [];

        for (const [ attr, details ] of state.attrs.entries()) {
            const str = item.cells.get(attr);
            outputEls.push(rightPadSpaces(str, details.width));
        }
        log(outputEls.join(` ${vertLineChar} `));
    }
}
