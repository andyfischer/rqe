
import Token from './Token'
import TokenIterator from './TokenIterator'
import unescape from './unescape'
import { t_quoted_string } from './tokens'
import SourcePos from './SourcePos'

export default class LexedText {
    tokens: Token[]
    originalStr?: string
    iterator: TokenIterator

    constructor(originalStr: string) {
        this.originalStr = originalStr;
    }

    getTokenText(token: Token) {
        return this.originalStr.slice(token.startPos, token.endPos);
    }

    getUnquotedText(token: Token) {
        if (token.match === t_quoted_string) {
            const str = this.originalStr.slice(token.startPos + 1, token.endPos - 1);
            return unescape(str);
        }

        return this.getTokenText(token);
    }

    tokenCharIndex(tokenIndex: number) {
        if (tokenIndex >= this.tokens.length)
            return this.originalStr.length;

        return this.tokens[tokenIndex].startPos;
    }
}
