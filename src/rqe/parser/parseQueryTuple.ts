
import { TokenIterator, t_plain_value, t_newline, t_bar, t_slash,
    t_integer, t_rparen, t_right_arrow, lexStringToIterator } from './lexer'
import { parseQueryTagFromTokens } from './parseQueryTag'
import { ParseError } from './ParseError'
import { QueryStep, QueryAttrs, QueryTagEntry } from '../Query'

interface Context {
    expectVerb?: boolean
}

function maybeParseVerbWithCount(it: TokenIterator): QueryStep {
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
    const attrs: QueryAttrs = {
        count: {
            t: 'tag',
            value: { t: 'str_value', str: count },
        },
    }

    for (const entry of parseTags(it)) {
        attrs[entry.attr] = entry.tag;
    }

    return {
        t: 'step',
        verb,
        attrs,
    }
}

function maybeParseWaitVerb(it: TokenIterator): QueryStep {
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

    const attrs: QueryAttrs = {
        duration: {
            t: 'tag',
            value: { t: 'str_value', str: duration },
        },
    }

    for (const entry of parseTags(it)) {
        attrs[entry.attr] = entry.tag;
    }

    return {
        t: 'step',
        verb,
        attrs,
    }
}

function maybeParseRename(it: TokenIterator): QueryStep {
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
    const attrs: QueryAttrs = {
        from: {
            t: 'tag',
            value: { t: 'str_value', str: from },
        },
        to: {
            t: 'tag',
            value: { t: 'str_value', str: to },
        }
    }

    for (const entry of parseTags(it)) {
        attrs[entry.attr] = entry.tag;
    }

    return {
        t: 'step',
        verb: 'rename',
        attrs,
    }
}

function maybeParseWhere(it: TokenIterator) {
    let startPos = it.position;

    if (it.nextText() !== "where")
        return null;

    it.consume();
    it.skipSpaces();

    const conditions = [];

    // TODO
}

const specialSyntaxPaths = [
    maybeParseVerbWithCount,
    maybeParseRename,
    maybeParseWaitVerb,
];

function* parseTags(it: TokenIterator) {
    while (true) {
        it.skipSpaces();

        if (it.finished() || it.nextIs(t_newline) || it.nextIs(t_bar) || it.nextIs(t_slash) || it.nextIs(t_rparen))
            break;

        const tag: QueryTagEntry = parseQueryTagFromTokens(it);

        yield tag;
    }
}

export function parseQueryTupleFromTokens(it: TokenIterator, ctx: Context): QueryStep | ParseError {

    it.skipSpaces();

    // Special syntaxes
    for (const path of specialSyntaxPaths) {
        const parseSuccess = path(it);
        if (parseSuccess)
            return parseSuccess;
    }
    
    let tags: QueryTagEntry[] = [];
    
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

    let verbEntry: QueryTagEntry;

    if (ctx.expectVerb) {
        verbEntry = tags[0];
        tags = tags.slice(1);
        
        if (verbEntry.tag.value.t !== 'no_value') {
            return {
                t: 'parseError',
                parsing: 'queryTuple',
                message: `Didn't expect value on verb`
            }
        }

        if (verbEntry.tag.identifier) {
            return {
                t: 'parseError',
                parsing: 'queryTuple',
                message: `Didn't expect identifier on verb`
            }
        }
    }

    // Validate attrs - look for duplicates and reserved words.
    const foundAttrs = new Map<string, true>();
    const attrs: QueryAttrs = {};
    for (const entry of tags) {
        const attr = entry.attr;

        if (!attr)
            continue;

        if (foundAttrs.get(attr))
            throw new Error("Duplicate attr: " + attr);

        if (attr === 'get')
            throw new Error("Found reserved attr 'get'");

        foundAttrs.set(attr, true);
        attrs[attr] = entry.tag;
    }

    return {
        t: 'step',
        verb: verbEntry ? (verbEntry.attr as string) : 'get',
        attrs,
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

    return result as QueryStep;
}
