
import { MemoryTable as Table } from './MemoryTable'

export class TableSchemaIssue extends Error {
    constructor(table: Table, message: string) {
        super(`Table [${table.name()}] schema issue: ${message}`);
    }
}

interface TableImplementationMetadata {
    filename?: string
}

export class TableImplementationError extends Error {
    constructor(message: string, meta?: TableImplementationMetadata) {
        super(`Module error: ${message}`);
    }
}
