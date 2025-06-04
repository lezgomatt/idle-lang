
const SYMBOLS = [
    "(", ")", "[", "]", "{", "}",
    ".", ",", ":", "=",
];

type Token = { line: number, col: number, start: number, end: number } & (
    | { t: "symb", value: string }
    | { t: "ident", value: string }
    | { t: "int", value: number }
    | { t: "doc", value: string }
    | { t: "str", value: string }
);

// TODO: Convert this to a generator (?)
function tokenize(input: string): Token[] {
    let offset = 0;
    let line = 1;
    let lineOffset = 0;
    let tokens: Token[] = []; // FIXME

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

        // Identifier (includes soft keywords like "import", "as", "true", "false")
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
                line,
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

    return tokens;
}
