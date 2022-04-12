
import { TokenIterator, lexStringToIterator, t_right_arrow, t_colon } from './lexer'
import { MountPointSpec, MountAttr } from '../MountPoint'
import { ParseError } from './ParseError'
import { parseQueryTagFromTokens } from './parseQueryTag'

interface ParseContext {
}

export function parseTableDeclFromTokens(it: TokenIterator, ctx: ParseContext): MountPointSpec | ParseError {
    const out: MountPointSpec = {
        t: 'mountPointSpec',
        attrs: {}
    };

    let hasSeenArrow = false;

    while (!it.finished()) {
        it.skipSpaces();

        if (it.finished())
            break;


        if (it.tryConsume(t_right_arrow)) {
            hasSeenArrow = true;
            continue;
        }

        if (it.tryConsume(t_colon)) {
            // Everything on the left side is a namespace.
            for (const config of Object.values(out.attrs))
                config.requiresValue = false;
            continue;
        }

        const tag = parseQueryTagFromTokens(it);

        if (tag.tag.specialAttr)
            throw new Error("star not supported in table decl");

        const resultAttr: MountAttr = {
            required: !hasSeenArrow,
            requiresValue: !hasSeenArrow,
        };

        out.attrs[tag.attr] = resultAttr;

        if (tag.tag.value.t !== 'no_value') {
            if (hasSeenArrow)
                throw new Error("can't add tags with values after ->");

            resultAttr.specificValue = tag.tag.value;
            resultAttr.requiresValue = false;
        }
    }

    return out;
}

export function parseTableDecl(str: string) {
    try {
        const it = lexStringToIterator(str);
        return parseTableDeclFromTokens(it, {});
    } catch (err) {
        console.error('error parsing: ', str);
        throw err;
    }
}
