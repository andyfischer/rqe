
import { Table } from './Table/index'
import { TableSchema } from './Schema'
import { QueryStep, queryStepToString } from './Query'

export type ErrorType = 'verb_not_found' | 'unhandled_error' | 'provider_not_found' | 'missing_parameter'
    | 'no_table_found' | 'Unimplemented' | 'TableNotFound'
    | 'MissingAttrs' | 'MissingValue' | 'NotSupported' | 'ExtraAttrs'

export interface ErrorItem {
    errorType: ErrorType
    stack?: any
    message?: string
    step?: number
    verb?: string
    query?: QueryStep
    phase?: 'prepare' | 'execute'
}

export class TableSchemaIssue extends Error {
    constructor(table: Table, message: string) {
        super(`Table [${table.name}] schema issue: ${message}`);
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

export function errorItemToString(item: ErrorItem) {
    let out = `${item.errorType} error`;

    const otherDetails = { ...item };

    delete otherDetails.errorType;
    delete otherDetails.stack;
    delete otherDetails.message;
    delete otherDetails.query;
    delete otherDetails.step;
    delete otherDetails.phase;

    const otherDetailsString = JSON.stringify(otherDetails);

    if (item.message)
        out += `: ${item.message}`;

    if (item.query)
        out += ` (${queryStepToString(item.query)})`;

    if (otherDetailsString !== '{}')
        out += ` ${otherDetailsString}`

    if (item.stack)
        out += `\nStack trace: ${item.stack}`

    return out;
}

export function newErrorTable() {
    return new Table<ErrorItem>(ErrorTableSchema);
}
