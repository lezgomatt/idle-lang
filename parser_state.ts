import { Token, tokenize } from "./lexer";

export class ParserState {
    private tokens: Token[];
    private index: number;

    constructor(sourceText: string) {
        this.tokens = tokenize(sourceText);
        this.index = 0;
    }

    peek(expectedType: string | string[] | null = null, expectedValue: string | null = null, offset: number = 0) {
        let next = this.tokens[this.index + offset];

        if (expectedType != null && (
            typeof expectedType === "string" && next.t !== expectedType
            || Array.isArray(expectedType) && !expectedType.includes(next.t)
        )) {
            return null;
        }

        if (expectedValue != null && next.value !== expectedValue) {
            return null;
        }

        return next;
    }

    eat(expectedType: string | string[] | null = null, expectedValue: string | null = null, errorMessage: string | null = null) {
        let tok = this.peek(expectedType, expectedValue);
        if (tok == null) {
            let next = this.tokens[this.index];
            // FIXME: Provide a more descriptive message for the tokens
            throw new Error(`Unexpected token "${next.t}" on line ${next.line}:${next.col}`);
        }

        if (tok.t !== "eof") {
            this.index++;
        }

        return tok;
    }
}
