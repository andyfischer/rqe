
import { TokenIterator, lexStringToIterator, t_right_arrow } from '../lexer';
import { Handler, HandlerTag } from '../handler'
import { ParseError } from './ParseError';
import { QueryTag } from '../query';
import { parseQueryTagFromTokens } from './parseQueryTag';

export function parseHandlerFromTokens(it: TokenIterator): Handler | ParseError {
    const handlerTags: HandlerTag[] = [];

    let hasSeenArrow = false;

    while (!it.finished()) {
        it.skipSpaces();

        if (it.finished())
            break;

        if (it.tryConsume(t_right_arrow)) {
            hasSeenArrow = true;
            continue;
        }

        const tag: QueryTag = parseQueryTagFromTokens(it);

        const resultTag: HandlerTag = {
            attr: tag.attr,
            required: !tag.isAttrOptional && !hasSeenArrow,
            requiresValue: (tag.isParameter && !tag.isValueOptional) && !hasSeenArrow,
            isParameter: tag.isParameter || tag.isValueOptional,
            isOutput: hasSeenArrow,
        };

        if (tag.attr === ":") 
            throw new Error("colon not supported in table decl: " + it.sourceText?.originalStr);

        if (tag.value != null) {
            throw new Error("value not supported in table decl: " + it.sourceText?.originalStr);
        }

        handlerTags.push(resultTag);
    }

    return new Handler(handlerTags);
}

export function parseHandler(str: string) {
    str = str as string;

    if (str.startsWith('[v2]')) {
        str = str.replace('[v2]','');
    }

    const it = lexStringToIterator(str);
    const result = parseHandlerFromTokens(it);

    if (result.t === 'parseError') {
        throw new Error(`parse error on "${str}": ` + result);
    }

    const handler = result as Handler;

    return handler;

}