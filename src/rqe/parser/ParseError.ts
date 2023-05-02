
export class ParseError extends Error {
    t = 'parseError'
    message: string

    constructor(message) {
        super(message);
    }
}
