import { ParserState } from "./parser_state";
import { Definition, Flag, Import, Literal, Parameter, Property, Specification } from "./types";

// TODO: Minimize the use of "as" (need to improve the type of parser state)
// TODO: Provide better error messages

export function parse(s: ParserState) {
    let imports: Import[] = [];
    let defs: Definition[] = [];

    while (s.peek("eof") == null) {
        if (s.peek("symb", "[") != null) {
            defs.push(parseDefinition(s));
            continue;
        }

        let tok = s.peek("ident");
        if (tok == null) {
            throw new Error("Unexpected statement on line: " + s.peek()?.line); // FIXME
        }

        if (tok.value === "import") {
            imports.push(parseImport(s));
        } else {
            defs.push(parseDefinition(s));
        }
    }

    return { imports, defs };
}

function parseImport(s: ParserState): Import {
    s.eat("ident", "import");

    let chunks: string[] = [];
    let alias: string | null = null;

    chunks.push(s.eat("ident").value as string);
    while (s.peek("symb", ".") != null) {
        s.eat("symb", ".");
        chunks.push(s.eat("ident").value as string);
    }

    if (s.peek("ident", "as") != null) {
        s.eat("ident", "as");
        alias = s.eat("ident").value as string;
    }

    return { namespace: chunks.join("."), alias };
}

function parseDefinition(s: ParserState): Definition {
    let flags: Flag[] = [];
    while (s.peek("symb", "[") != null) {
        flags.push(parseFlag(s));
    }

    let kind: string = s.eat("ident").value as string;
    let name: string = s.eat("ident").value as string;

    s.eat("symb", "{");

    let doc: string | null = null;
    if (s.peek("doc") != null) {
        doc = s.eat("doc").value as string;
    }

    let props: Property[] = [];
    while (s.peek("ident") != null || s.peek("symb", "[") != null) {
        props.push(parseProperty(s));
    }

    s.eat("symb", "}");

    return { flags, kind, name, doc, props };
}

function parseFlag(s: ParserState): Flag {
    s.eat("symb", "[");

    let name: string = s.eat("ident").value as string;

    let params: Parameter[] = [];
    if (s.peek("symb", "(") != null) {
        s.eat("symb", "(");
        params = parseParameterList(s);
        s.eat("symb", ")");
    }

    s.eat("symb", "]");

    return { name, params };
}

function parseParameterList(s: ParserState): Parameter[] {
    let params: Parameter[] = [];

    if (s.peek(["ident", "str", "int"]) != null || s.peek("symb", "[") != null) {
        params.push(parseParameter(s));
        while (s.peek("symb", ",") != null) {
            s.eat("symb", ",");
            params.push(parseParameter(s));
        }
    }

    return params;
}

function parseParameter(s: ParserState): Parameter {
    if (s.peek(["str", "int"]) != null) {
        return { name: null, value: s.eat(["str", "int"]).value as string | number };
    }

    // Named parameter
    if (s.peek("symb", ":", 1)) {
        let name = s.eat("ident").value as string;
        return { name, value: parseSpecification(s) };
    }

    return { name: null, value: parseSpecification(s) };
}

function parseProperty(s: ParserState): Property {
    let flags: Flag[] = [];
    while (s.peek("symb", "[") != null) {
        flags.push(parseFlag(s));
    }

    let kind: string | null = null;
    let name: string = s.eat("ident").value as string;
    if (s.peek("ident") != null) {
        kind = name;
        name = s.eat("ident").value as string;
    }

    let spec: Specification | null = null;
    if (s.peek("symb", ":") != null) {
        s.eat("symb", ":");
        spec = parseSpecification(s);
    }

    let value: Literal | null = null;
    if (s.peek("symb", "=") != null) {
        s.eat("symb", "=");
        value = s.eat(["str", "int"]).value as string | number;
    }

    let doc: string | null = null;
    if (s.peek("doc") != null) {
        doc = s.eat("doc").value as string;
    }


    return { flags, kind, name, spec, value, doc };
}

function parseSpecification(s: ParserState): Specification {
    let name: string | null = null;
    if (s.peek("ident") != null) {
        name = s.eat("ident").value as string;
    }

    let params: Parameter[] = [];
    if (s.peek("symb", "[") != null || name == null) {
        s.eat("symb", "[");
        params = parseParameterList(s);
        s.eat("symb", "]");
    }

    return { name, params };
}
