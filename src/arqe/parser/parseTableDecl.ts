
import { TokenIterator, lexStringToIterator, t_plain_value, t_right_arrow } from './lexer'
import { MountPointSpec } from '../MountPoint'
import ParseError from './ParseError'

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

        if (it.nextIs(t_plain_value)) {
            const attr = it.consumeAsText();

            if (!hasSeenArrow) {
                out.attrs[attr] = { required: true };
            } else {
                out.attrs[attr] = { required: false };
            }

            continue;
        }

        if (it.nextIs(t_right_arrow)) {
            it.consume();
            hasSeenArrow = true;
            continue;
        }

        throw new Error("unexpected in table declaration: " + it.nextText());
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
