
import { TokenIterator, Token, TokenDef, t_quoted_string, t_star,
    t_space, t_hash, t_newline, t_bar, t_slash,
    t_dot, t_question, t_integer, t_dash, t_dollar, t_lbracket, t_rbracket,
    t_lparen, t_rparen, t_equals, t_line_comment, lexStringToIterator } from './lexer'
import { parseQueryTupleFromTokens } from './parseQueryTuple'
import ParseError from './ParseError'
import { Query, QueryTuple } from '../Query'

interface ParseContext {
    expectTransform?: boolean
}

export function parseQueryFromTokens(it: TokenIterator, ctx: ParseContext): Query | ParseError {

    const steps: QueryTuple[] = [];
    let isFirst = true;

    while (!it.finished()) {

        // -  If the caller says expectTransform=true, then we expect a verb.
        // -  Otherwise, the first tuple does not expect a verb.

        const expectVerb = !isFirst || ctx.expectTransform;
        isFirst = false;

        it.skipSpaces();

        if (it.finished())
            break;

        if (it.nextIs(t_bar)) {
            // Queries can start with a leading | , which means to interpret this as a transform.
            // Consume it and loop (and isFirst will be false on next iteration)
            it.consume();
            continue;
        }

        const step: QueryTuple | ParseError = parseQueryTupleFromTokens(it, { expectVerb });
        if (step.t === 'parseError')
            return step;

        steps.push(step);

        if (!it.tryConsume(t_bar))
            break;

    }

    return {
        t: 'pipedQuery',
        steps,
    }
}

export function parseQuery(str: string, ctx: ParseContext = {}) {
    try {
        const it = lexStringToIterator(str);
        return parseQueryFromTokens(it, ctx);
    } catch (err) {
        console.error('error parsing: ', str);
        throw err;
    }
}
