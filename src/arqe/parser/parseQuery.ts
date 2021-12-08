
import { TokenIterator, Token, TokenDef, t_plain_value, t_quoted_string, t_star,
    t_space, t_hash, t_newline, t_bar, t_slash,
    t_dot, t_question, t_integer, t_dash, t_dollar, t_lbracket, t_rbracket,
    t_lparen, t_rparen, t_equals, t_line_comment, lexStringToIterator } from './lexer'
import { parseQueryTupleFromTokens } from './parseQueryTuple'
import ParseError from './ParseError'
import { Query, QueryStep } from '../Query'

interface ParseContext {
    expect?: 'query' | 'transform'
}

export function parseQueryFromTokens(it: TokenIterator, ctx: ParseContext): Query | ParseError {

    const steps: QueryStep[] = [];
    let isFirst = true;

    while (!it.finished()) {

        // First tuple of a query does not have a verb.
        const expectVerb = !(ctx.expect === 'query' && isFirst);

        it.skipSpaces();

        if (it.finished())
            break;

        const step: QueryStep | ParseError = parseQueryTupleFromTokens(it, { expectVerb });
        if (step.t === 'parseError')
            return step;

        if (!expectVerb && step.t === 'queryStep') {
            step.verb = 'get';
        }

        steps.push(step);

        if (!it.tryConsume(t_bar))
            break;

        isFirst = false;
    }

    return {
        t: 'pipedQuery',
        steps,
    }
}

export function parseQuery(str: string, ctx: ParseContext = { expect: 'query' }) {
    try {
        const it = lexStringToIterator(str);
        return parseQueryFromTokens(it, ctx);
    } catch (err) {
        console.error('error parsing: ', str);
        throw err;
    }
}
