
import { TokenIterator, Token, TokenDef, t_plain_value, t_quoted_string, t_star,
    t_space, t_hash, t_newline, t_bar, t_slash,
    t_dot, t_question, t_integer, t_dash, t_dollar, t_lbracket, t_rbracket,
    t_lparen, t_rparen, t_equals, t_right_arrow, t_ident, lexStringToIterator } from './lexer'
import { parseQueryTagFromTokens } from './parseQueryTag'
import ParseError from './ParseError'
import { QueryTuple, QueryTag } from '../Query'

interface Context {
    expectVerb?: boolean
}

function maybeParseVerbWithCount(it: TokenIterator): QueryTuple {
    let startPos = it.position;

    if (it.nextText() !== "limit" && it.nextText() !== "last")
        return null;

    const verb = it.nextText();
    it.consume();
    it.skipSpaces();

    if (!it.nextIs(t_integer)) {
        it.position = startPos;
        return null;
    }

    const count = it.nextText();
    it.consume(t_integer);

    // Success
    const tags: QueryTag[] = [
        {t: 'tag', attr: 'count', value: { t: 'str_value', str: count }},
    ];

    for (const tag of parseTags(it))
        tags.push(tag);

    return {
        t: 'queryStep',
        verb,
        tags,
    }
}

function maybeParseWaitVerb(it: TokenIterator): QueryTuple {
    let startPos = it.position;

    if (it.nextText() !== "wait")
        return null;

    const verb = it.nextText();
    it.consume();
    it.skipSpaces();

    if (!it.nextIs(t_integer)) {
        it.position = startPos;
        return null;
    }

    const duration = it.nextText();
    it.consume(t_integer);

    const tags: QueryTag[] = [
        {t: 'tag', attr: 'duration', value: { t: 'str_value', str: duration }},
    ];

    for (const tag of parseTags(it))
        tags.push(tag);

    return {
        t: 'queryStep',
        verb,
        tags,
    }
}

function maybeParseRename(it: TokenIterator): QueryTuple {
    let startPos = it.position;

    if (it.nextText() !== "rename")
        return null;

    const verb = it.nextText();
    it.consume();
    it.skipSpaces();

    let from: string;
    let to: string;

    if (!it.nextIs(t_plain_value)) {
        it.position = startPos;
        return null;
    }

    from = it.consumeAsText();
    it.skipSpaces();

    if (!it.nextIs(t_right_arrow)) {
        it.position = startPos;
        return null;
    }

    it.consume(t_right_arrow);
    it.skipSpaces();

    if (!it.nextIs(t_plain_value)) {
        it.position = startPos;
        return null;
    }

    to = it.consumeAsText();

    // Success

    const tags: QueryTag[] = [
        {t: 'tag', attr: 'from', value: { t: 'str_value', str: from }},
        {t: 'tag', attr: 'to', value: { t: 'str_value', str: to }},
    ];

    for (const tag of parseTags(it))
        tags.push(tag);

    return {
        t: 'queryStep',
        verb: 'rename',
        tags,
    }
}

function* parseTags(it: TokenIterator) {
    while (true) {
        it.skipSpaces();

        if (it.finished() || it.nextIs(t_newline) || it.nextIs(t_bar) || it.nextIs(t_rparen))
            break;

        const tag = parseQueryTagFromTokens(it);

        yield tag;
    }
}

export function parseQueryTupleFromTokens(it: TokenIterator, ctx: Context): QueryTuple | ParseError {

    it.skipSpaces();

    // Special syntaxes

    const withCount = maybeParseVerbWithCount(it);
    if (withCount)
        return withCount;

    const rename = maybeParseRename(it);
    if (rename)
        return rename;

    const wait = maybeParseWaitVerb(it);
    if (wait)
        return wait;
    
    let tags: QueryTag[] = [];
    
    for (const tag of parseTags(it)) {
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
        
        if (verbTag.value.t !== 'no_value') {
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
        verb: verbTag ? (verbTag.attr as string) : 'get',
        tags,
    }
}

export function parseQueryTuple(str: string, ctx: Context = {}) {
    const it = lexStringToIterator(str);
    return parseQueryTupleFromTokens(it, ctx);
}

export function parseQueryTupleWithErrorCheck(str: string, ctx: Context = {}) {
    const result = parseQueryTuple(str, ctx);
    if (result.t === 'parseError')
        throw new Error("Parse error: " + str);

    return result as QueryTuple;
}
