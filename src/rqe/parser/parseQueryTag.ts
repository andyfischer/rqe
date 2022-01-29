
import { TokenIterator, Token, TokenDef, t_plain_value, t_quoted_string, t_star,
    t_space, t_hash, t_newline, t_bar, t_slash,
    t_dot, t_question, t_integer, t_dash, t_dollar, t_lbracket, t_rbracket,
    t_lparen, t_rparen, t_equals, t_double_dash, lexStringToIterator } from './lexer'
import { QueryTag } from '../Query'
import { TaggedValue } from '../TaggedValue'
import { parseQueryFromTokens } from './parseQuery'

export function parseQueryTagFromTokens(it: TokenIterator): QueryTag {

    let identifier = null;

    // Identifier prefix
    if (it.tryConsume(t_lbracket)) {
        identifier = it.consumeAsText();

        if (!it.tryConsume(t_rbracket))
            throw new Error("expected ']', found: " + it.nextText());

        it.skipSpaces();
    }

    if (it.tryConsume(t_star)) {
        return {
            t: 'tag',
            specialAttr: { t: 'star' },
            value: { t: 'no_value' },
            identifier,
        }
    }

    if (it.tryConsume(t_dollar)) {
        const unboundVar = it.consumeAsUnquotedText();
        return {
            t: 'tag',
            specialAttr: { t: 'star' },
            value: { t: 'no_value' },
            identifier: unboundVar,
        }
    }

    let isFlag = false;
    if (it.tryConsume(t_double_dash))
        isFlag = true;

    // Attribute
    let attr = it.consumeAsUnquotedText();
    while (it.nextIs(t_plain_value)
            || it.nextIs(t_dot)
            || it.nextIs(t_dash)
            || it.nextIs(t_integer)
            || it.nextIs(t_slash))
        attr += it.consumeAsUnquotedText();

    if (attr === '/')
        throw new Error("syntax error, attr was '/'");

    let isOptional = false;

    if (it.tryConsume(t_question)) {
        isOptional = true;
    }

    let value: TaggedValue = {
        t: 'no_value'
    };

    if (it.tryConsume(t_equals)) {
        it.skipSpaces();

        if (it.nextIs(t_lparen)) {
            const query = parseQueryFromTokens(it, {});

            if (query.t === 'parseError')
                throw new Error("Parse error: " + query.t);

            if (!it.tryConsume(t_rparen))
                throw new Error('Expected )');

            return {
                t: 'tag',
                attr,
                value: {
                    t: 'query_value',
                    query,
                }
            }
        }

        let strValue = it.consumeAsUnquotedText();
        while (it.nextIs(t_plain_value) || it.nextIs(t_dot) || it.nextIs(t_slash))
            strValue += it.consumeAsUnquotedText();

        value = { t: 'str_value', str: strValue };
    }

    const result: QueryTag = {
        t: 'tag',
        attr,
        value,
    }

    if (isOptional)
        result.isOptional = true;

    if (identifier)
        result.identifier = identifier;

    if (isFlag)
        result.isFlag = true;

    return result;
}

export function parseQueryTag(str: string): QueryTag {
    const it = lexStringToIterator(str);
    return parseQueryTagFromTokens(it);
}
