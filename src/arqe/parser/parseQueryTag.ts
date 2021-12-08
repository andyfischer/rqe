
import { TokenIterator, Token, TokenDef, t_plain_value, t_quoted_string, t_star,
    t_space, t_hash, t_newline, t_bar, t_slash,
    t_dot, t_question, t_integer, t_dash, t_dollar, t_lbracket, t_rbracket,
    t_lparen, t_rparen, t_equals, lexStringToIterator } from './lexer'
import { QueryTag, QueryTagValue } from '../Query'

export function parseQueryTagFromTokens(it: TokenIterator): QueryTag {

    let identifier = null;

    // Identifier prefix
    if (it.tryConsume(t_lbracket)) {
        identifier = it.consumeNextText();

        if (!it.tryConsume(t_rbracket))
            throw new Error("expected ']', found: " + it.nextText());

        it.skipSpaces();
    }

    if (it.tryConsume(t_star)) {
        return {
            t: 'queryTag',
            specialAttr: { t: 'star' },
            value: { t: 'noValue' },
            identifier,
        }
    }

    if (it.tryConsume(t_dollar)) {
        const unboundVar = it.consumeNextUnquotedText();
        return {
            t: 'queryTag',
            specialAttr: { t: 'star' },
            value: { t: 'noValue' },
            identifier: unboundVar,
        }
    }

    // Attribute
    let attr = it.consumeNextUnquotedText();
    while (it.nextIs(t_plain_value)
            || it.nextIs(t_dot)
            || it.nextIs(t_dash)
            || it.nextIs(t_integer)
            || it.nextIs(t_slash))
        attr += it.consumeNextUnquotedText();

    if (attr === '/')
        throw new Error("syntax error, attr was '/'");

    let isOptional = false;

    if (it.tryConsume(t_question)) {
        isOptional = true;
    }

    let value: QueryTagValue = {
        t: 'noValue'
    };

    // Value
    /*
    if (it.tryConsume(t_lparen)) {

        const value = parseTupleTokens(it);

        if (!it.tryConsume(t_rparen))
            throw new Error('Expected )');

        return {
            t: 'queryTag',
            attr,
            value
        }
    }
    */

    if (it.tryConsume(t_equals)) {
        it.skipSpaces();

        /*
        if (it.nextIs(t_lparen)) {
            const value = parseTupleTokens(it);

            if (!it.tryConsume(t_rparen))
                throw new Error('Expected )');

            return {
                t: 'queryTag,
                attr,
                value,
            }
        }
        */

        let strValue = it.consumeNextUnquotedText();
        while (it.nextIs(t_plain_value) || it.nextIs(t_dot) || it.nextIs(t_slash))
            strValue += it.consumeNextUnquotedText();

        value = { t: 'strValue', str: strValue };
    }

    const result: QueryTag = {
        t: 'queryTag',
        attr,
        value,
    }

    if (isOptional)
        result.isOptional = true;

    if (identifier)
        result.identifier = identifier;

    return result;
}

export function parseQueryTag(str: string): QueryTag {
    const it = lexStringToIterator(str);
    return parseQueryTagFromTokens(it);
}
