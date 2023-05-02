
import { parseQuery } from '../parser'
import { Query } from '../query'

export function parseCommandLineArgs(): Query {
    const str = process.argv.slice(2).join(' ');
    if (str === '')
        return new Query([]);

    const result = parseQuery(str);

    if (result.t === 'parseError')
        throw new Error("Parse error:" + result)

    return result as Query;
}

