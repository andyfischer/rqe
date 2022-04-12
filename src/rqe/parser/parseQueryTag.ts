
import { TokenIterator, t_plain_value, t_star, t_slash,
    t_dot, t_question, t_integer, t_dash, t_dollar, t_lbracket, t_rbracket,
    t_lparen, t_rparen, t_equals, t_double_dash, lexStringToIterator } from './lexer'
import { Query, QueryStep, QueryTagEntry } from '../Query'
import { parseQueryFromTokens } from './parseQuery'
import { ParseError } from './ParseError'

export function parseQueryTagFromTokens(it: TokenIterator): QueryTagEntry {

    const result: QueryTagEntry = {
        attr: null,
        tag: {
            t: 'tag',
            value: {
                t: 'no_value'
            }
        }
    }

    // Identifier prefix
    if (it.tryConsume(t_lbracket)) {
        result.tag.identifier = it.consumeAsText();

        if (!it.tryConsume(t_rbracket))
            throw new Error("expected ']', found: " + it.nextText());

        it.skipSpaces();
    }

    if (it.tryConsume(t_star)) {
        result.tag.specialAttr = { t: 'star' };
        return result;
    }

    if (it.tryConsume(t_dollar)) {
        const unboundVar = it.consumeAsUnquotedText();
        result.attr = unboundVar;
        result.tag.identifier = unboundVar;
        return result;
    }

    if (it.tryConsume(t_double_dash))
        result.tag.isFlag = true;

    // Attribute
    result.attr = it.consumeAsUnquotedText();
    while (it.nextIs(t_plain_value)
            || it.nextIs(t_dot)
            || it.nextIs(t_dash)
            || it.nextIs(t_integer)
            || it.nextIs(t_slash))
        result.attr += it.consumeAsUnquotedText();

    if (result.attr === '/')
        throw new Error("syntax error, attr was '/'");

    if (it.tryConsume(t_question)) {
        result.tag.isOptional = true;
    }

    if (it.tryConsume(t_lparen)) {
        let query: Query | QueryStep | ParseError = parseQueryFromTokens(it, { });
        if (query.t === 'parseError')
            throw new Error(query.message);

        // Simplify to just the QueryStep.
        if (query.t === 'query' && query.steps.length === 1)
            query = query.steps[0];

        result.tag.value = query;

        if (!it.tryConsume(t_rparen))
            throw new Error("Expected )");

        return result;
    }

    if (it.tryConsume(t_equals)) {
        it.skipSpaces();

        if (it.tryConsume(t_lparen)) {
            const query = parseQueryFromTokens(it, {});

            if (query.t === 'parseError')
                throw new Error("Parse error: " + query.t);

            if (!it.tryConsume(t_rparen))
                throw new Error('Expected )');

            result.tag.value = query;
        } else {

            let strValue = it.consumeAsUnquotedText();
            while (it.nextIs(t_plain_value) || it.nextIs(t_dot) || it.nextIs(t_slash))
                strValue += it.consumeAsUnquotedText();

            result.tag.value = { t: 'str_value', str: strValue };
        }
    }

    return result;
}

export function parseQueryTag(str: string): QueryTagEntry {
    const it = lexStringToIterator(str);
    return parseQueryTagFromTokens(it);
}
