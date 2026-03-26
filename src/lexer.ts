import { Position, Source } from "./types.ts";

export class TokenStream {
    private readonly tokens: Token[];
    private index: number;

    constructor(path: string, input: string) {
        this.tokens = tokenize(path, input);
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

    eat(expectedType: string | string[] | null = null, expectedValue: string | null = null, _errorMessage: string | null = null) {
        let tok = this.peek(expectedType, expectedValue);
        if (tok == null) {
            let next = this.tokens[this.index];
            let pos = next.source.start;
            // FIXME: Provide a more descriptive message for the tokens
            throw new Error(`Unexpected token "${next.t}" on line ${pos.line}:${pos.col}`);
        }

        if (tok.t !== "eof") {
            this.index++;
        }

        return tok;
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
    | { t: "int", value: number }
    | { t: "doc", value: string }
    | { t: "str", value: string }
    | { t: "eof", value: null }
);

export const LITERAL_TOKENS = ["str", "nil", "bool", "int"];

export function tokenize(path: string, input: string): Token[] {
    let offset = 0;
    let line = 1;
    let lineOffset = 0;

    function getPos(): Position {
        let col = offset - lineOffset + 1;

        return { line, col, offset };
    }

    let tokens: Token[] = [];

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
            tokens.push({ source, t: "symb", value });

            continue;
        }

        // ============ [ Identifier or keyword ] ============ //
        if (input[offset].match(/^[_A-Za-z]/)) {
            let start = getPos();

            offset++;
            while (offset < input.length && input[offset].match(/^[_0-9A-Za-z]/)) {
                offset++;
            }

            let end = getPos();

            let value = input.slice(start.offset, end.offset);

            let source = { path, start, end };

            switch (value) {
            case "nil":
                tokens.push({ source, t: "nil", value: null });
                break;
            case "true":
                tokens.push({ source, t: "bool", value: true });
                break;
            case "false":
                tokens.push({ source, t: "bool", value: false });
                break;
            default:
                // Note: This includes soft keywords like "import", "as".
                tokens.push({ source, t: "ident", value });
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
            tokens.push({ source, t: "doc", value });

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
            tokens.push({ source, t: "str", value });

            continue;
        }


        // ============ [ Integer ] ============ //
        if (input[offset].match(/^[0-9]/)) {
            let start = getPos();

            offset++;
            while (offset < input.length && input[offset].match(/^[0-9]/)) {
                offset++;
            }

            let end = getPos();

            let value = Number(input.slice(start.offset, end.offset));

            let source = { path, start, end };
            tokens.push({ source, t: "int", value });

            continue;
        }

        throw new Error(`Unexpected character: ${input[offset]} on line ${line}`);
    }

    let pos = getPos();
    let source = { path, start: pos, end: pos };
    tokens.push({ source, t: "eof", value: null });

    return tokens;
}
