
import Token from './Token'
import unescape from './unescape'
import { t_quoted_string } from './tokens'

export default class LexedText {
    tokens: Token[]
    originalStr: string

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

    getTextRange(startPos: number, endPos: number) {
        let out = '';

        for (let i = startPos; i < endPos; i++)
            out += this.getTokenText(this.tokens[i]);

        return out;
    }
}
