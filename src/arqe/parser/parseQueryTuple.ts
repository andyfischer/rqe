
import { TokenIterator, Token, TokenDef, t_plain_value, t_quoted_string, t_star,
    t_space, t_hash, t_newline, t_bar, t_slash,
    t_dot, t_question, t_integer, t_dash, t_dollar, t_lbracket, t_rbracket,
    t_lparen, t_rparen, t_equals, lexStringToIterator } from './lexer'
import { parseQueryTagFromTokens } from './parseQueryTag'
import ParseError from './ParseError'
import { QueryStep, QueryTag } from '../Query'

interface Context {
    expectVerb: boolean
}

export function parseQueryTupleFromTokens(it: TokenIterator, ctx: Context): QueryStep | ParseError {
    let tags: QueryTag[] = [];

    while (true) {
        it.skipSpaces();

        if (it.finished() || it.nextIs(t_newline) || it.nextIs(t_bar) || it.nextIs(t_rparen))
            break;

        const tag = parseQueryTagFromTokens(it);

        tags.push(tag);
    }

    if (tags.length === 0 && ctx.expectVerb) {
        return {
            t: 'parseError',
            parsing: 'queryTuple',
            message: 'No verb found'
        }
    }

    let verbTag: QueryTag;

    if (ctx.expectVerb) {
        verbTag = tags[0];
        tags = tags.slice(1);
        
        if (verbTag.value.t !== 'noValue') {
            return {
                t: 'parseError',
                parsing: 'queryTuple',
                message: `Didn't expect value on verb`
            }
        }

        if (verbTag.identifier) {
            return {
                t: 'parseError',
                parsing: 'queryTuple',
                message: `Didn't expect identifier on verb`
            }
        }
    }

    // Validate attrs - look for duplicates and reserved words.
    const foundAttrs = new Map<string, true>();
    for (const tag of tags) {
        const attr = tag.attr;

        if (!attr)
            continue;

        if (foundAttrs.get(attr))
            throw new Error("duplicate attr: " + attr);

        if (attr === 'get')
            throw new Error("Found reserved attr 'get'");

        foundAttrs.set(attr, true);
    }

    return {
        t: 'queryStep',
        verb: verbTag ? (verbTag.attr as string) : null,
        tags,
    }
}

export function parseQueryTuple(str: string, ctx: Context) {
    const it = lexStringToIterator(str);
    return parseQueryTupleFromTokens(it, ctx);
}
