
import { printItemsAsTable } from '../repl/consolePrintTable'

export function platformExtendClass(clss) {
    let Util;

    try {
        Util = require('util');
    } catch (e) {
        return;
    }

    clss[Util.inspect.custom] = (depth, opts) => {
        let prefix = '';
        if (this.name())
            prefix = `${this.name()} = `;

        let lines = printItemsAsTable(this.list());
        let indent = ' '.repeat(prefix.length);

        if (prefix.length)
            lines = lines.map((line, index) => {
                if (index === 0)
                    return prefix + line;
                return indent + line
            });

        return lines.join('\n');
    }
}

