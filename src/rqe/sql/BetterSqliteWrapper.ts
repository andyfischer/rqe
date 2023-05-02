
import { IDSource } from '../utils/IDSource'
import { Stream } from '../Stream'

interface BetterSqliteDb {

}

const nextStatementId = new IDSource()

interface SqlStatement {
    id: number
    sql: string
}

// Template tag function
export function sql(strings): SqlStatement {
    if (!strings.hack)
        strings.hack = nextStatementId

    if (strings.length > 1)
        throw new Error("sql tag function doesn't expect multiple strings");

    const result = {
        id: strings.hack,
        sql: strings[0],
    }

    console.log('compiled', result)

    return result;
}

export class BetterSqliteWrapper {
    constructor(db: BetterSqliteDb) {

    }
}

sql`example`;

function main() {
    console.log('main start')
    sql`create table foo (id integer primary key, name text);`

    for (let i = 0; i < 3; i++)
        sql`example in loop`

    console.log('main done')
}

main()
