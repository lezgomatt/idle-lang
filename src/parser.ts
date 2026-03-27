import { LITERAL_TOKENS, TokenStream } from "./lexer.ts";
import { Definition, Flag, Import, Literal, Parameter, Property, Source, Specification } from "./types.ts";
import { transformReferences } from "./utils.ts";

// TODO: Minimize the use of "as" (need to improve the type of parser state)
// TODO: Provide better error messages

export function parse(path: string, text: string) {
    let tokens = new TokenStream(path, text);

    return parseIdle(tokens);
}

function parseIdle(ts: TokenStream): Definition[] {
    let imports: Map<string, string> = new Map();
    let defs: Definition[] = [];

    for (let tok = ts.peek("ident"); tok != null && tok.value === "import"; tok = ts.peek("ident")) {
            let imp = parseImport(ts);
            // TODO: Detect duplicates
            imports.set(imp.alias, imp.path);
    }

    while (ts.peek("eof") == null) {
        defs.push(parseDefinition(ts));
    }

    return defs.map((d) => transformReferences(d, (name) => expandImportAlias(imports, name)));
}

function expandImportAlias(imports: Map<string, string>, name: string) {
    let separator = name.indexOf(".");
    if (separator === -1) {
        return name;
    }

    let potentialAlias = name.slice(0, separator);
    let importPath = imports.get(potentialAlias);
    if (importPath == null) {
        return name;
    }

    return `${importPath}.${name.slice(separator + 1)}`;
}

function parseImport(ts: TokenStream): Import {
    ts.eat("ident", "import");

    let { source, components } = parseIdentPath(ts);

    let alias = components.at(-1)!;
    if (ts.peek("ident", "as") != null) {
        ts.eat("ident", "as");
        alias = ts.eat("ident").value as string;
    }

    return { source, path: components.join("."), alias };
}

function parseDefinition(ts: TokenStream): Definition {
    let flags: Flag[] = [];
    while (ts.peek("symb", "[") != null) {
        flags.push(parseFlag(ts));
    }

    let kind: string = ts.eat("ident").value as string;
    let ident = ts.eat("ident");
    let name: string = ident.value as string;
    let source = ident.source;

    ts.eat("symb", "{");

    let doc: string | null = null;
    if (ts.peek("doc") != null) {
        doc = ts.eat("doc").value as string;
    }

    let props: Property[] = [];
    while (ts.peek("ident") != null || ts.peek("symb", "[") != null) {
        props.push(parseProperty(ts));
    }

    ts.eat("symb", "}");

    return { source, flags, kind, name, doc, props };
}

function parseFlag(ts: TokenStream): Flag {
    ts.eat("symb", "[");

    let ident = ts.eat("ident");
    let name: string = ident.value as string;
    let source = ident.source;

    let params: Parameter[] = [];
    if (ts.peek("symb", "(") != null) {
        ts.eat("symb", "(");
        params = parseParameterList(ts);
        ts.eat("symb", ")");
    }

    ts.eat("symb", "]");

    return { source, name, params };
}

function parseParameterList(ts: TokenStream): Parameter[] {
    let params: Parameter[] = [];

    if (ts.peek(["ident"]) != null || ts.peek(LITERAL_TOKENS) != null) {
        params.push(parseParameter(ts));
        while (ts.peek("symb", ",") != null) {
            ts.eat("symb", ",");
            params.push(parseParameter(ts));
        }
    }

    return params;
}

function parseParameter(ts: TokenStream): Parameter {
    if (ts.peek(LITERAL_TOKENS) != null) {
        let literal = ts.eat(LITERAL_TOKENS);

        return { source: literal.source, name: null, value: literal.value };
    }

    // Named parameter
    if (ts.peek("symb", ":", 1) != null) {
        let ident = ts.eat("ident");
        let name = ident.value as string;
        let source = ident.source;

        ts.eat("symb", ":");

        if (ts.peek(LITERAL_TOKENS) != null) {
            return { source, name, value: ts.eat(LITERAL_TOKENS).value };
        } else {
            return { source, name, value: parseSpecification(ts) };
        }
    }

    let spec = parseSpecification(ts);

    return { source: spec.source, name: null, value: spec };
}

function parseProperty(ts: TokenStream): Property {
    let flags: Flag[] = [];
    while (ts.peek("symb", "[") != null) {
        flags.push(parseFlag(ts));
    }

    let firstIdent = ts.eat("ident");
    let nextIdent = ts.peek("ident");
    if (nextIdent != null) {
        ts.eat("ident");
    }

    let [kind, name, source] = (nextIdent != null && nextIdent.source.start.line === firstIdent.source.end.line)
        ? [firstIdent.value as string, nextIdent.value as string, nextIdent.source]
        : [null, firstIdent.value as string, firstIdent.source];

    let spec: Specification | null = null;
    if (ts.peek("symb", ":") != null) {
        ts.eat("symb", ":");
        spec = parseSpecification(ts);
    }

    let value: Literal | null = null;
    if (ts.peek("symb", "=") != null) {
        ts.eat("symb", "=");
        value = ts.eat(LITERAL_TOKENS).value;
    }

    let doc: string | null = null;
    if (ts.peek("doc") != null) {
        doc = ts.eat("doc").value as string;
    }

    return { source, flags, kind, name, spec, value, doc };
}

function parseSpecification(ts: TokenStream): Specification {
    let { source, components } = parseIdentPath(ts);

    let name: string = components.join(".");
    let params: Parameter[] = [];
    if (ts.peek("symb", "[") != null && ts.peek("symb", "[")!.source.start.line == source.end.line) {
        ts.eat("symb", "[");
        params = parseParameterList(ts);
        ts.eat("symb", "]");
    }

    return { source, name, params };
}

function parseIdentPath(ts: TokenStream): { source: Source, components: string[] } {
    let components: string[] = [];

    let ident = ts.eat("ident");
    components.push(ident.value as string);
    let source = ident.source;

    while (ts.peek("symb", ".") != null) {
        ts.eat("symb", ".");
        let ident = ts.eat("ident");
        components.push(ident.value as string);
        source.end = ident.source.end;
    }

    return { source, components };
}
