// export type Source = {
//     path: string,
//     line: number,
//     col: number,
// }

export type Import = {
    // source: Source,
    path: string,
    alias: string,
};

export type Definition = {
    // source: Source,
    flags: Flag[],
    kind: string,
    name: string,
    doc: string | null,
    props: Property[],
};

export type Flag = { // AKA annotation
    // source: Source,
    name: string,
    params: Parameter[],
};

export type Property = { // AKA field
    // source: Source,
    flags: Flag[],
    kind: string | null, // or modifier
    name: string,
    spec: Specification | null,
    value: Literal | null,
    doc: string | null,
};

export type Specification = { // i.e. a type specification
    // source: Source,
    name: string | null,
    params: Parameter[],
};

export type Parameter = {
    // source: Source,
    name: string | null,
    value: Specification | Literal,
};

export type Literal = boolean | number | string;
