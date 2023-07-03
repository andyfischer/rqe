
import { Table } from './Table'
import { formatTable } from '../repl/TableFormatter'

export function consoleLogTable(table: Table) {
    for (const line of formatTable(table))
        console.log(line);
}
