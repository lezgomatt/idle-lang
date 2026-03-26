import { LITERAL_TOKENS, TokenStream } from "./lexer.ts";
import { Definition, Flag, Import, Literal, Parameter, Property, Specification } from "./types.ts";

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

    return defs.map((d) => resolveImportsDefinition(imports, d));
}

function resolveImportsDefinition(imports: Map<string, string>, def: Definition): Definition {
    return {
        ...def,
        flags: def.flags.map((f) => resolveImportsFlag(imports, f)),
        props: def.props.map((p) => resolveImportsProperty(imports, p)),
    };
}

function resolveImportsProperty(imports: Map<string, string>, prop: Property): Property {
    return {
        ...prop,
        flags: prop.flags.map((f) => resolveImportsFlag(imports, f)),
        spec: prop.spec == null ? null : resolveImportsSpecification(imports, prop.spec),
    }
}

function resolveImportsFlag(imports: Map<string, string>, flag: Flag): Flag {
    return {
        ...flag,
        params: flag.params.map((p) => resolveImportsParameter(imports, p)),
    }
}

function resolveImportsParameter(imports: Map<string, string>, param: Parameter): Parameter {
    if (param.value == null || typeof param.value !== "object") {
        return param;
    }

    return { ...param, value: resolveImportsSpecification(imports, param.value) };
}

function resolveImportsSpecification(imports: Map<string, string>, spec: Specification): Specification {
    return {
        ...spec,
        name: resolveImportsName(imports, spec.name),
        params: spec.params.map((p) => resolveImportsParameter(imports, p)),
    }
}

function resolveImportsName(imports: Map<string, string>, name: string) {
    let m = name.match(/^([^.]+)\.(.+)$/);
    if (m == null) {
        return name;
    }

    let path = imports.get(m[1]);
    if (path == null) {
        return name;
    }

    return `${path}.${m[2]}`;
}

function parseImport(ts: TokenStream): Import {
    ts.eat("ident", "import");

    let components: string[] = [];

    let alias: string = ts.eat("ident").value as string;
    components.push(alias);

    while (ts.peek("symb", ".") != null) {
        ts.eat("symb", ".");
        alias = ts.eat("ident").value as string;
        components.push(alias);
    }

    if (ts.peek("ident", "as") != null) {
        ts.eat("ident", "as");
        alias = ts.eat("ident").value as string;
    }

    return { path: components.join("."), alias };
}

function parseDefinition(ts: TokenStream): Definition {
    let flags: Flag[] = [];
    while (ts.peek("symb", "[") != null) {
        flags.push(parseFlag(ts));
    }

    let kind: string = ts.eat("ident").value as string;
    let name: string = ts.eat("ident").value as string;

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

    return { flags, kind, name, doc, props };
}

function parseFlag(ts: TokenStream): Flag {
    ts.eat("symb", "[");

    let name: string = ts.eat("ident").value as string;

    let params: Parameter[] = [];
    if (ts.peek("symb", "(") != null) {
        ts.eat("symb", "(");
        params = parseParameterList(ts);
        ts.eat("symb", ")");
    }

    ts.eat("symb", "]");

    return { name, params };
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
        return { name: null, value: ts.eat(LITERAL_TOKENS).value };
    }

    // Named parameter
    if (ts.peek("symb", ":", 1) != null) {
        let name = ts.eat("ident").value as string;
        ts.eat("symb", ":");
        if (ts.peek(LITERAL_TOKENS) != null) {
            return { name, value: ts.eat(LITERAL_TOKENS).value };
        } else {
            return { name, value: parseSpecification(ts) };
        }
    }

    return { name: null, value: parseSpecification(ts) };
}

function parseProperty(ts: TokenStream): Property {
    let flags: Flag[] = [];
    while (ts.peek("symb", "[") != null) {
        flags.push(parseFlag(ts));
    }

    let kind: string | null = null;
    let identToken = ts.eat("ident");
    let name: string = identToken.value as string;
    if (ts.peek("ident") != null && ts.peek("ident")!.source.end.line === identToken.source.start.line) {
        kind = name;
        name = ts.eat("ident").value as string;
    }

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

    return { flags, kind, name, spec, value, doc };
}

function parseSpecification(ts: TokenStream): Specification {
    let ident = ts.eat("ident");
    let components = [ident.value as string];
    while (ts.peek("symb", ".") != null) {
        ts.eat("symb", ".");
        ident = ts.eat("ident");
        components.push(ident.value as string);
    }

    let name: string = components.join(".");
    let params: Parameter[] = [];
    if (ts.peek("symb", "[") != null && ts.peek("symb", "[")!.source.start.line == ident.source.end.line) {
        ts.eat("symb", "[");
        params = parseParameterList(ts);
        ts.eat("symb", "]");
    }

    return { name, params };
}
