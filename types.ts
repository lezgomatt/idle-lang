type InterfaceFile = {
    path: string, // absolute or relative (?)
    namespace: string,
    imports: Import[],
    defs: Definition[],
};

type Import = {
    source: [InterfaceFile, number, number],
    namespace: string,
    alias: string | null,
};

type Definition = {
    flags: Flag[],
    kind: string,
    name: string,
    doc: string | null,
    props: Property[],
};

type Flag = { // AKA annotation
    name: string,
    params: Parameter[],
};

type Property = { // AKA field
    flags: Flag[],
    kind: string | null, // or modifier
    name: string,
    doc: string | null,
    spec: Specification | null,
    value: Literal | null,
};

type Specification = { // i.e. a type specification
    name: string | null,
    params: Parameter[],
};

type Parameter = {
    name: string | null,
    value: Specification | Literal,
};

type Literal = boolean | number | string;
