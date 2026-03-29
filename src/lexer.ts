import { Position, Source } from "./types.ts";

export class TokenStream {
    private readonly tokens: Iterator<Token>;
    private buffer: Token[] = [];

    constructor(path: string, input: string) {
        this.tokens = tokenize(path, input);
    }

    peek<T extends keyof TokenTypeMap>(expectedType: T | readonly T[] | null = null, expectedValue: string | null = null, offset: number = 0): TokenTypeMap[T] | null {
        let next = this.getNextToken(offset);

        if (expectedType != null && (
            typeof expectedType === "string" && next.t !== expectedType
            || Array.isArray(expectedType) && !expectedType.includes(next.t as T)
        )) {
            return null;
        }

        if (expectedValue != null && next.value !== expectedValue) {
            return null;
        }

        return next as TokenTypeMap[T] | null;
    }

    eat<T extends keyof TokenTypeMap>(expectedType: T | readonly T[] | null = null, expectedValue: string | null = null, _errorMessage: string | null = null): TokenTypeMap[T] {
        let tok = this.peek(expectedType, expectedValue);
        if (tok == null) {
            let next = this.getNextToken();
            let pos = next.source.start;
            // FIXME: Provide a more descriptive message for the tokens
            throw new Error(`Unexpected token "${next.t}" on line ${pos.line}:${pos.col}`);
        }

        if (tok.t !== "eof") {
            this.buffer.shift();
        }

        return tok;
    }

    private getNextToken(offset: number = 0) {
        while (this.buffer.length <= offset) {
            let next = this.tokens.next();
            if (next.done) {
                // FIXME: Handle this better...
                break;
            }

            this.buffer.push(next.value);
        }

        return this.buffer[offset];
    }
}

// NOTE: The code currently assumes that a symbol is a single character.
const SYMBOLS = [
    "(", ")", "[", "]", "{", "}",
    ".", ",", ":", "=",
];

export type Token = { source: Source } & (
    | { t: "symb", value: string }
    | { t: "ident", value: string }
    | { t: "nil", value: null }
    | { t: "bool", value: boolean }
    | { t: "num", value: number }
    | { t: "doc", value: string }
    | { t: "str", value: string }
    | { t: "eof", value: null }
);

export type TokenTypeMap = { [T in Token as T["t"]]: T };

export const LITERAL_TOKENS = ["str", "nil", "bool", "num"] as const;

export function* tokenize(path: string, input: string): Iterator<Token> {
    let offset = 0;
    let line = 1;
    let lineOffset = 0;

    function getPos(): Position {
        let col = offset - lineOffset + 1;

        return { line, col, offset };
    }

    top: while (offset < input.length) {
        // ============ [ Whitespace ] ============ //
        while (offset < input.length && input[offset].match(/^\s/)) {
            if (input[offset] === "\n") {
                line++;
                lineOffset = offset + 1;
            }

            offset++;

            continue top;
        }

        // ============ [ Comment ] ============ //
        if (input.startsWith("//", offset)) {
            offset += 2;

            while (offset < input.length && input[offset] !== "\n") {
                offset++;
            }

            continue;
        }

        // ============ [ Symbol ] ============ //
        if (SYMBOLS.includes(input[offset])) {
            let start = getPos();

            let value = input[offset];
            offset++;

            let end = getPos();

            let source = { path, start, end };
            yield { source, t: "symb", value };

            continue;
        }

        // ============ [ Identifier or keyword ] ============ //
        let identMatch = input.slice(offset).match(/^[_A-Za-z][_0-9A-Za-z]*/);
        if (identMatch != null) {
            let start = getPos();

            let value = identMatch[0];
            offset += value.length;

            let end = getPos();

            let source = { path, start, end };

            switch (value) {
            case "nil":
                yield { source, t: "nil", value: null };
                break;
            case "true":
                yield { source, t: "bool", value: true };
                break;
            case "false":
                yield { source, t: "bool", value: false };
                break;
            default:
                // Note: This includes soft keywords like "import", "as".
                yield { source, t: "ident", value };
            }

            continue;
        }

        // ============ [ Doc string ] ============ //
        if (input.startsWith("``", offset)) {
            let start = getPos();

            offset += 2; // Eat the opening quote

            while (offset < input.length && !input.startsWith("``", offset)) {
                if (input[offset] === "\n") {
                    line++;
                    lineOffset = offset + 1;
                }

                offset++;
            }

            if (!input.startsWith("``", offset)) {
                throw new Error(`Missing doc string terminator that started on line ${start.line}`);
            }

            offset += 2; // Eat the closing quote

            let end = getPos();

            let docLines = input.slice(start.offset + 2, end.offset - 2).split("\n");
            let value = docLines.map((line) => line.trim()).join("\n").trim();

            let source = { path, start, end };
            yield { source, t: "doc", value };

            continue;
        }

        // ============ [ String ] ============ //
        if (input[offset] === "\"") {
            let start = getPos();

            offset++; // Eat the opening quote
            while (offset < input.length && input[offset] !== "\n" && input[offset] !== "\"") {
                offset++;
            }

            if (input[offset] !== "\"") {
                throw new Error(`Missing string terminator on line ${line}`);
            }

            offset++; // Eat the closing quote

            let end = getPos();

            let value = input.slice(start.offset + 1, end.offset - 1);

            let source = { path, start, end };
            yield { source, t: "str", value };

            continue;
        }


        // ============ [ Number ] ============ //
        let numMatch = input.slice(offset).match(/^-?[0-9][_0-9]*(\.[0-9][_0-9]*)?/);
        if (numMatch != null) {
            let start = getPos();

            let value = Number(numMatch[0].replaceAll("_", ""));
            offset += numMatch[0].length;

            let end = getPos();

            let source = { path, start, end };
            yield { source, t: "num", value };

            continue;
        }

        throw new Error(`Unexpected character: ${input[offset]} on line ${line}`);
    }

    let pos = getPos();
    let source = { path, start: pos, end: pos };
    yield { source, t: "eof", value: null };
}
