export type IDLEFile = {
    path: string, // absolute or relative (?)
    namespace: string,
    imports: Import[],
    defs: Definition[],
};

// TODO: Add `source: [IDLEFile, number, number]`

export type Import = {
    namespace: string,
    alias: string | null,
};

export type Definition = {
    flags: Flag[],
    kind: string,
    name: string,
    doc: string | null,
    props: Property[],
};

export type Flag = { // AKA annotation
    name: string,
    params: Parameter[],
};

export type Property = { // AKA field
    flags: Flag[],
    kind: string | null, // or modifier
    name: string,
    spec: Specification | null,
    value: Literal | null,
    doc: string | null,
};

export type Specification = { // i.e. a type specification
    name: string | null,
    params: Parameter[],
};

export type Parameter = {
    name: string | null,
    value: Specification | Literal,
};

export type Literal = boolean | number | string;
