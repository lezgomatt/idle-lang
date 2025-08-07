import { TokenStream } from "./lexer.ts";
import { Definition, Flag, Import, Literal, Parameter, Property, Specification } from "./types.ts";

// TODO: Minimize the use of "as" (need to improve the type of parser state)
// TODO: Provide better error messages
export function parse(s: string) {
    let tokens = new TokenStream("path-fixme", s);

    return parseIdle(tokens);
}

function parseIdle(ts: TokenStream): Definition[] {
    let imports: Map<string, string> = new Map();
    let defs: Definition[] = [];

    while (ts.peek("eof") == null) {
        if (ts.peek("symb", "[") != null) {
            defs.push(parseDefinition(ts));
            continue;
        }

        let tok = ts.peek("ident");
        if (tok == null) {
            throw new Error("Unexpected statement on line: " + ts.peek()?.line); // FIXME
        }

        if (tok.value === "import") {
            // TODO: Detect duplicates
            let imp = parseImport(ts);
            imports.set(imp.alias, imp.path);
        } else {
            defs.push(parseDefinition(ts));
        }
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
    return {
        ...param,
        value: typeof param.value !== "object" ? param.value : resolveImportsSpecification(imports, param.value),
    }
}

function resolveImportsSpecification(imports: Map<string, string>, spec: Specification): Specification {
    return {
        ...spec,
        name: spec.name == null ? null : resolveImportsName(imports, spec.name),
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

    let chunks: string[] = [];

    let alias: string = ts.eat("ident").value as string;
    chunks.push(alias);

    while (ts.peek("symb", ".") != null) {
        ts.eat("symb", ".");
        alias = ts.eat("ident").value as string;
        chunks.push(alias);
    }

    if (ts.peek("ident", "as") != null) {
        ts.eat("ident", "as");
        alias = ts.eat("ident").value as string;
    }

    return { path: chunks.join("."), alias };
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

    if (ts.peek(["ident", "str", "int"]) != null || ts.peek("symb", "[") != null) {
        params.push(parseParameter(ts));
        while (ts.peek("symb", ",") != null) {
            ts.eat("symb", ",");
            params.push(parseParameter(ts));
        }
    }

    return params;
}

function parseParameter(ts: TokenStream): Parameter {
    if (ts.peek(["str", "int"]) != null) {
        return { name: null, value: ts.eat(["str", "int"]).value as string | number };
    }

    // Named parameter
    if (ts.peek("symb", ":", 1) != null) {
        let name = ts.eat("ident").value as string;
        ts.eat("symb", ":");
        return { name, value: parseSpecification(ts) };
    }

    return { name: null, value: parseSpecification(ts) };
}

function parseProperty(ts: TokenStream): Property {
    let flags: Flag[] = [];
    while (ts.peek("symb", "[") != null) {
        flags.push(parseFlag(ts));
    }

    let kind: string | null = null;
    let name: string = ts.eat("ident").value as string;
    if (ts.peek("ident") != null) {
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
        value = ts.eat(["str", "int"]).value as string | number;
    }

    let doc: string | null = null;
    if (ts.peek("doc") != null) {
        doc = ts.eat("doc").value as string;
    }

    return { flags, kind, name, spec, value, doc };
}

function parseSpecification(ts: TokenStream): Specification {
    let name: string | null = null;
    if (ts.peek("ident") != null) {
        let chunks = [ts.eat("ident").value as string];
        while (ts.peek("symb", ".") != null) {
            ts.eat("symb", ".");
            chunks.push(ts.eat("ident").value as string);
        }
        name = chunks.join(".");
    }

    let params: Parameter[] = [];
    if (ts.peek("symb", "[") != null || name == null) {
        ts.eat("symb", "[");
        params = parseParameterList(ts);
        ts.eat("symb", "]");
    }

    return { name, params };
}
