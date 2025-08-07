export class TokenStream {
    public readonly path: string;
    private readonly tokens: Token[];
    private index: number;

    constructor(path: string, sourceText: string) {
        this.path = path;
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

    eat(expectedType: string | string[] | null = null, expectedValue: string | null = null, _errorMessage: string | null = null) {
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

const SYMBOLS = [
    "(", ")", "[", "]", "{", "}",
    ".", ",", ":", "=",
];

// TODO: Simplify how the position is calculated
export type Token = { line: number, col: number, start: number, end: number } & (
    | { t: "symb", value: string }
    | { t: "ident", value: string }
    | { t: "int", value: number }
    | { t: "doc", value: string }
    | { t: "str", value: string }
    | { t: "eof", value: null }
);

export function tokenize(input: string): Token[] {
    let offset = 0;
    let line = 1;
    let lineOffset = 0;
    let tokens: Token[] = [];

    top: while (offset < input.length) {
        // Skip whitespace
        while (offset < input.length && input[offset].match(/^\s/)) {
            if (input[offset] === "\n") {
                line++;
                lineOffset = offset + 1;
            }

            offset++;

            continue top;
        }

        // Skip comments
        if (input.startsWith("//", offset)) {
            offset += 2;

            while (offset < input.length && input[offset] !== "\n") {
                offset++;
            }

            continue;
        }

        // Symbol
        if (SYMBOLS.includes(input[offset])) {
            tokens.push({
                t: "symb",
                value: input[offset],
                line,
                col: offset - lineOffset + 1,
                start: offset,
                end: offset + 1,
            });

            offset++; // Eat the symbol

            continue;
        }

        // Identifier (includes soft keywords like "import", "as")
        if (input[offset].match(/^[_A-Za-z]/)) {
            let start = offset;
            offset++;

            while (offset < input.length && input[offset].match(/^[_0-9A-Za-z]/)) {
                offset++;
            }

            tokens.push({
                t: "ident",
                value: input.slice(start, offset),
                line,
                col: start - lineOffset + 1,
                start,
                end: offset,
            });

            continue;
        }

        // Integer
        if (input[offset].match(/^[0-9]/)) {
            let start = offset;
            offset++;

            while (offset < input.length && input[offset].match(/^[0-9]/)) {
                offset++;
            }

            tokens.push({
                t: "int",
                value: Number(input.slice(start, offset)),
                line,
                col: start - lineOffset + 1,
                start,
                end: offset,
            });

            continue;
        }

        // Doc string
        if (input.startsWith("``", offset)) {
            offset += 2; // Eat the opening quote

            let start = offset;
            let startLine = line;
            let docLineStart = start;
            let docLines: string[] = [];
            while (offset < input.length && !input.startsWith("``", offset)) {
                if (input[offset] === "\n") {
                    line++;
                    lineOffset = offset + 1;
                    docLines.push(input.slice(docLineStart, offset));
                    docLineStart = lineOffset;
                }
                offset++;
            }

            if (!input.startsWith("``", offset)) {
                throw new Error(`Missing doc string terminator that started on line ${startLine}`);
            }

            docLines.push(input.slice(docLineStart, offset));
            let value = docLines.map((line) => line.trim()).join("\n").trim();

            tokens.push({
                t: "doc",
                value,
                line: startLine,
                col: (start - 2) - lineOffset + 1,
                start: start - 2,
                end: offset + 2,
            });

            offset += 2; // Eat the closing quote

            continue;
        }

        // String
        if (input[offset] === "\"") {
            offset++; // Eat the opening quote

            let start = offset;
            while (offset < input.length && input[offset] !== "\n" && input[offset] !== "\"") {
                offset++;
            }

            if (input[offset] !== "\"") {
                throw new Error(`Missing string terminator on line ${line}`);
            }

            tokens.push({
                t: "str",
                value: input.slice(start, offset),
                line,
                col: (start - 1) - lineOffset + 1,
                start: start - 1,
                end: offset + 1,
            });

            offset++; // Eat the closing quote

            continue;
        }

        throw new Error(`Unexpected character: ${input[offset]} on line ${line}`);
    }

    tokens.push({
        t: "eof",
        value: null,
        line,
        col: offset - lineOffset + 1,
        start: offset,
        end: offset
    });

    return tokens;
}
