
import { TokenIterator, t_bar, t_slash, lexStringToIterator } from './lexer'
import { parseQueryTupleFromTokens } from './parseQueryTuple'
import { ParseError } from './ParseError'
import { Query, QueryStep } from '../Query'

interface ParseContext {
    expectTransform?: boolean
}

export function parseQueryFromTokens(it: TokenIterator, ctx: ParseContext): Query | ParseError {

    const steps: QueryStep[] = [];
    let isFirst = true;

    while (!it.finished()) {

        // -  If the caller says expectTransform=true, then we expect a verb.
        // -  Otherwise, the first tuple does not expect a verb.

        const expectVerb = !isFirst || ctx.expectTransform;
        isFirst = false;

        it.skipSpaces();

        if (it.finished())
            break;

        if (it.nextIs(t_bar) || it.nextIs(t_slash)) {
            // Queries can start with a leading | , which means to interpret this as a transform.
            // Consume it and loop (and isFirst will be false on next iteration)
            it.consume();
            continue;
        }

        const step: QueryStep | ParseError = parseQueryTupleFromTokens(it, { expectVerb });
        if (step.t === 'parseError')
            return step;

        steps.push(step);

        if (!it.tryConsume(t_bar) && !it.tryConsume(t_slash))
            break;

    }

    return {
        t: 'query',
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
