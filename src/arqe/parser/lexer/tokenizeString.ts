
import Context from './Context'
import TokenIterator from './TokenIterator'
import Token from './Token'
import TokenDef from './TokenDef'
import LexedText from './LexedText'
import { t_ident, t_integer, t_unrecognized, t_space, t_double_dash,
    t_line_comment, t_quoted_string, t_double_equals,
    t_plain_value, tokenFromSingleCharCode } from './tokens'

const c_0 = '0'.charCodeAt(0);
const c_9 = '9'.charCodeAt(0);
const c_a = 'a'.charCodeAt(0);
const c_z = 'z'.charCodeAt(0);
const c_A = 'A'.charCodeAt(0);
const c_Z = 'Z'.charCodeAt(0);
const c_dash = '-'.charCodeAt(0);
const c_under = '_'.charCodeAt(0);
const c_space = ' '.charCodeAt(0);
const c_equals = '='.charCodeAt(0);
const c_dot = '.'.charCodeAt(0);
const c_newline = '\n'.charCodeAt(0);
const c_hash = '#'.charCodeAt(0);
const c_single_quote = "'".charCodeAt(0);
const c_double_quote = "\"".charCodeAt(0);
const c_backslash = '\\'.charCodeAt(0);

function isLowerCase(c) {
    return c >= c_a && c <= c_z;
}

function isUpperCase(c) {
    return c >= c_A && c <= c_Z;
}

function isDigit(c) {
    return c >= c_0 && c <= c_9;
}

function isPlainValueCharacter(c) {
    return (isLowerCase(c) || isUpperCase(c) || isDigit(c)
        || c === c_dash
        || c === c_under)
}

function canStartIdentifier(c) {
    return isLowerCase(c) || isUpperCase(c) || c === c_under;
}

function canContinueIdentifier(c) {
    return (isLowerCase(c) || isUpperCase(c) || isDigit(c)
        || c === c_dash
        || c === c_under);
}

function consumeNumber(input: Context) {
    // todo, handle floats

    return input.consumeWhile(t_integer, isDigit);
}

function consumeQuotedString(input: Context, lookingFor: number) {
    let lookahead = 1;

    while (true) {
        if (input.finished(lookahead))
            break;

        if (input.next(lookahead) === c_backslash) {
            // escape next character
            lookahead += 2;
            continue;
        }

        if (input.next(lookahead) === lookingFor) {
            lookahead += 1;
            break;
        }

        lookahead += 1;
    }

    return input.consume(t_quoted_string, lookahead);
}

function consumePlainValue(input: Context) {
    let lookahead = 0;
    let allNumbers = true;

    while (isPlainValueCharacter(input.next(lookahead))) {
        if (!isDigit(input.next(lookahead)))
            allNumbers = false;
        lookahead++;
    }

    if (allNumbers)
        return input.consume(t_integer, lookahead);
    else
        return input.consume(t_plain_value, lookahead);
}

function consumeNext(input: Context) {
    const c: number = input.next(0);

    if (isPlainValueCharacter(c))
        return consumePlainValue(input);

    if (canStartIdentifier(c))
        return input.consumeWhile(t_ident, canContinueIdentifier);

    if (c === c_hash)
        return input.consumeWhile(t_line_comment, c => c !== c_newline);

    if (c === c_single_quote)
        return consumeQuotedString(input, c_single_quote);
    
    if (c === c_double_quote)
        return consumeQuotedString(input, c_double_quote);

    if (c === c_space)
        return input.consumeWhile(t_space, c => c === c_space);

    if (isDigit(c))
        return consumeNumber(input);

    if (c === c_equals && input.next(1) === c_equals)
        return input.consume(t_double_equals, 2);

    if (c === c_dash && input.next(1) === c_dash)
        return input.consume(t_double_dash, 2);

    if (tokenFromSingleCharCode[c])
        return input.consume(tokenFromSingleCharCode[c], 1);

    return input.consume(t_unrecognized, 1);
}

export function tokenizeString(str: string): LexedText {
    const context = new Context(str);

    while (!context.finished()) {

        const pos = context.index;

        context.resultTokens.push(consumeNext(context));

        if (context.index === pos) {
            throw new Error(`internal error: lexer stalled at index `
                            +`${context.index} (next char is ${context.nextChar(0)}`);
        }
    }

    const result = new LexedText(str);
    result.tokens = context.resultTokens;
    result.iterator = new TokenIterator(context.resultTokens);
    result.iterator.result = result;
    return result;
}

export function lexStringToIterator(str: string): TokenIterator {
    const { iterator } = tokenizeString(str);
    return iterator;
}
