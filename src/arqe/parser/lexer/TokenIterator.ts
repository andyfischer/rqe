
import { Token, LexedText, t_space, t_newline, t_ident } from '.'
import SourcePos from './SourcePos'
import TokenDef from './TokenDef'

export default class TokenIterator {

    position: number = 0
    tokens: Token[]
    result?: LexedText

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    discardSpaces() {
        this.tokens = this.tokens.filter(token => token.match !== t_space);
    }

    getPosition() {
        return this.position;
    }

    next(lookahead: number = 0): Token {
        const pos = this.position + lookahead;

        if (pos < 0) {
            return {
                startPos: 0,
                endPos: 0,
                tokenIndex: 0,
                length: 0,
                lineStart: 0,
                columnStart: 0,
                leadingIndent: 0,
                match: null
            }
        }

        if (pos >= this.tokens.length) {
            const lastToken = this.tokens[this.tokens.length - 1];
            if (!lastToken) {
                return {
                    startPos: 0,
                    endPos: 0,
                    tokenIndex: -1,
                    length: 0,
                    lineStart: 0,
                    columnStart: 0,
                    leadingIndent: 0,
                    match: null
                }
            }
            return {
                startPos: lastToken.endPos,
                endPos: lastToken.endPos,
                tokenIndex: -1,
                length: 0,
                lineStart: lastToken.lineStart,
                columnStart: lastToken.columnStart + lastToken.length,
                leadingIndent: lastToken.leadingIndent,
                match: null
            }
        }

        return this.tokens[pos];
    }

    nextIs(match: TokenDef, lookahead: number = 0): boolean {
        const token = this.next(lookahead);
        return token.match === match;
    }

    nextText(lookahead: number = 0): string {
        const token = this.next(lookahead);
        return this.result.getTokenText(token);
    }

    nextIsIdentifier(str: string, lookahead: number = 0): boolean {
        return this.nextIs(t_ident, lookahead) && this.nextText(lookahead) === str;
    }

    nextUnquotedText(lookahead: number = 0): string {
        const token = this.next(lookahead);
        return this.result.getUnquotedText(token);
    }

    nextLength(lookahead: number = 0): number {
        const token = this.next(lookahead);
        return token.endPos - token.startPos;
    }

    finished(lookahead: number = 0): boolean {
        return (this.position + lookahead) >= this.tokens.length;
    }

    consume(match: TokenDef = null) {
        if (match !== null && !this.nextIs(match))
            throw new Error(`consume expected match: ${match.name}, found match: ${this.next().match.name}`);

        this.position += 1;
    }

    consumeIdentifier(s: string) {
        if (!this.nextIsIdentifier(s)) {
            throw new Error(`consume expected identifier: "${s}, found: ${this.nextText()}`);
        }

        this.position += 1;
    }

    consumeNextText(lookahead: number = 0): string {
        const str = this.nextText(lookahead);
        this.consume();
        return str;
    }

    consumeNextUnquotedText(lookahead: number = 0): string {
        const str = this.nextUnquotedText(lookahead);
        this.consume();
        return str;
    }


    consumeTextWhile(condition: (next: Token) => boolean) {
        let str = '';
        let stuckCounter = 0;

        while (!this.finished() && condition(this.next())) {
            str += this.consumeNextText();
            stuckCounter += 1;
            if (stuckCounter > 10000) {
                throw new Error("infinite loop in consumeTextWhile?")
            }
        }

        return str;
    }

    tryConsume(match: TokenDef): boolean {
        if (this.nextIs(match)) {
            this.consume();
            return true;
        }
        return false;
    }

    skipWhile(condition: (next: Token) => boolean) {
        while (condition(this.next()) && !this.finished())
            this.consume();
    }

    skipUntilNewline() {
        this.skipWhile(token => token.match !== t_newline);
        if (this.nextIs(t_newline))
            this.consume();
    }

    skipSpaces() {
        while (this.nextIs(t_space))
            this.consume(t_space);
    }

    consumeSpace() {
        while (this.nextIs(t_space))
            this.consume(t_space);
    }

    consumeWhitespace() {
        while (this.nextIs(t_space) || this.nextIs(t_newline))
            this.consume();
    }

    toSourcePos(firstToken: Token, lastToken: Token): SourcePos {
        return {
            posStart: firstToken.startPos,
            posEnd: lastToken.endPos,
            lineStart: firstToken.lineStart,
            columnStart: firstToken.columnStart,
            lineEnd: firstToken.lineStart,
            columnEnd: lastToken.columnStart + lastToken.length
        }
    }

    spanToString(startPos: number, endPos: number) {

        const startToken = this.tokens[startPos];
        const endToken = this.tokens[endPos];

        return this.result.originalStr.slice(startToken.startPos, endToken.endPos);
    }
}
