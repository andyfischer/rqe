
import { Token } from './Token'
import unescape from './unescape'
import { t_quoted_string } from './tokens'

export class LexedText {
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

    startCharOfToken(tokenIndex: number) {
        if (tokenIndex >= this.tokens.length)
            return this.originalStr.length;

        return this.tokens[tokenIndex].startPos;
    }

    endCharOfToken(tokenIndex: number) {
        if (tokenIndex >= this.tokens.length)
            return this.originalStr.length;

        return this.tokens[tokenIndex].endPos;
    }

    getTextRange(startToken: number, endToken: number) {
        const startPos = this.tokens[startToken].startPos;
        const endPos = this.tokens[endToken - 1].endPos;
        return this.originalStr.slice(startPos, endPos);
    }

    toDebugDump() {
        let out = [];

        for (const token of this.tokens) {
            let text = this.getTokenText(token);
            text = text.replace('\n', '\\n');
            out.push(`${token.match.name}: startPos=${token.startPos} endPos=${token.endPos} text=${text}`)
        }

        return out.join('\n')
    }
}
