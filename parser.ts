import { TokenStream } from "./lexer";
import { Definition, Flag, Import, Literal, Parameter, Property, Specification } from "./types";

// TODO: Minimize the use of "as" (need to improve the type of parser state)
// TODO: Provide better error messages

export function parse(ts: TokenStream) {
    let imports: Import[] = [];
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
            imports.push(parseImport(ts));
        } else {
            defs.push(parseDefinition(ts));
        }
    }

    return { imports, defs };
}

function parseImport(ts: TokenStream): Import {
    ts.eat("ident", "import");

    let chunks: string[] = [];
    let alias: string | null = null;

    chunks.push(ts.eat("ident").value as string);
    while (ts.peek("symb", ".") != null) {
        ts.eat("symb", ".");
        chunks.push(ts.eat("ident").value as string);
    }

    if (ts.peek("ident", "as") != null) {
        ts.eat("ident", "as");
        alias = ts.eat("ident").value as string;
    }

    return { namespace: chunks.join("."), alias };
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
    if (ts.peek("symb", ":", 1)) {
        let name = ts.eat("ident").value as string;
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
        name = ts.eat("ident").value as string;
    }

    let params: Parameter[] = [];
    if (ts.peek("symb", "[") != null || name == null) {
        ts.eat("symb", "[");
        params = parseParameterList(ts);
        ts.eat("symb", "]");
    }

    return { name, params };
}
