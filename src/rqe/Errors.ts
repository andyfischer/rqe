
import { StringIDSource } from './utils/IDSource'

export type ErrorType = 'verb_not_found' | 'unhandled_exception' | 'provider_not_found' | 'missing_parameter'
    | 'no_handler_found' | 'Unimplemented' | 'TableNotFound'
    | 'MissingAttrs' | 'MissingValue' | 'NotSupported' | 'ExtraAttrs'
    | 'http_protocol_error' | string

export interface ErrorItem {
    errorType?: ErrorType
    errorLayer?: string
    errorMessage?: string
    failureId?: string
    fromQuery?: string
    stack?: any
    cause?: any | Error
    info?: any
}

export interface ErrorContext {
    errorType?: ErrorType
    errorLayer?: string
    cause?: any | Error
}

let _nextFailureId = new StringIDSource('fail-');

export function errorItemToOneLineString(item: ErrorItem) {
    let out = `error (${item.errorType})`;

    if (item.errorMessage)
        out += `: ${item.errorMessage}`;

    return out;
}

export function errorItemToString(item: ErrorItem) {
    let out = `error (${item.errorType})`;

    if (item.errorMessage)
        out += `: ${item.errorMessage}`;

    if (item.stack)
        out += `\nStack trace: ${item.stack}`

    return out;
}

export class ErrorExtended extends Error {
    is_error_extended = true
    errorItem: ErrorItem

    constructor(errorItem: ErrorItem) {
        super(errorItem.errorMessage || errorItemToString(errorItem));
        this.errorItem = errorItem;
    }

    toString() {
        return errorItemToString(this.errorItem);
    }
}

export function toException(item: ErrorItem): ErrorExtended {
    return new ErrorExtended(item);
}

export function captureException(error: Error, context: ErrorContext = {}): ErrorItem {
    if ((error as ErrorExtended).errorItem) {
        const errorItem = (error as ErrorExtended).errorItem;

        return {
            errorMessage: errorItem.errorMessage,
            stack:  errorItem.stack || error.stack,
            ...context,
            errorType: errorItem.errorType || context.errorType || 'unhandled_exception',
        }
    }

    if (error instanceof Error) {
        return {
            errorMessage: error.message,
            stack: error.stack,
            ...context,
            errorType: (error as any).errorType || context.errorType || 'unhandled_exception',
        };
    }

    // Received some other value as an error.
    return {
        errorMessage: typeof error === 'string' ? error : ((error as any).errorMessage || (error as any).message),
        stack: (error as any).stack,
        ...context,
        errorType: (error as any).errorType || context.errorType || 'unknown_error',
    };
}

export function recordFailure(errorItem: ErrorItem) {
    errorItem.failureId = errorItem.failureId || _nextFailureId.take();

    // todo - more stuff here
    console.error('failure: ', errorItemToString(errorItem));

    return errorItem.failureId;
}

export function recordUnhandledException(error: Error) {
    // todo - more stuff here
    console.error('unhandled exception:')
    console.error(error);
}

