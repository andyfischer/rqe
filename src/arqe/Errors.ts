
import { Table } from './Table'
import { TableSchema } from './Schema'
import { QueryTuple } from './Query'

export type ErrorType = 'verb_not_found' | 'unhandled_error' | 'provider_not_found' | 'missing_parameter' | 'no_table_found' | 'Unimplemented' | 'TableNotFound'
    | 'MissingAttrs' | 'MissingValue' | 'NotSupported' | 'ExtraAttrs'

export interface ErrorItem {
    errorType: ErrorType
    stack?: any
    message?: string
    step?: number
    verb?: string
    query?: QueryTuple
    phase?: 'prepare' | 'execute'
}

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

export const ErrorTableSchema: TableSchema  = {
    attrs: {
        errorType: {},
        message: {},
        stack: {},
        step: {},
        phase: {},
    }
}

export function newErrorTable() {
    return new Table<ErrorItem>(ErrorTableSchema);
}
