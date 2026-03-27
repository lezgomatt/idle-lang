import { Definition, Flag, Parameter, Property, Specification } from "./types.ts";

export function transformReferences(def: Definition, transformer: (_: string) => string): Definition {
    return transformRefsDef(def, transformer);
}

function transformRefsDef(def: Definition, transformer: (_: string) => string): Definition {
    return {
        ...def,
        flags: def.flags.map((f) => transformRefsFlag(f, transformer)),
        props: def.props.map((p) => transformRefsProp(p, transformer)),
    };
}

function transformRefsFlag(flag: Flag, transformer: (_: string) => string): Flag {
    return {
        ...flag,
        params: flag.params.map((p) => transformRefsParam(p, transformer)),
    }
}

function transformRefsProp(prop: Property, transformer: (_: string) => string): Property {
    return {
        ...prop,
        flags: prop.flags.map((f) => transformRefsFlag(f, transformer)),
        spec: prop.spec == null ? null : transformRefsSpec(prop.spec, transformer),
    }
}

function transformRefsParam(param: Parameter, transformer: (_: string) => string): Parameter {
    if (param.value == null || typeof param.value !== "object") {
        return param;
    }

    return { ...param, value: transformRefsSpec(param.value, transformer) };
}

function transformRefsSpec(spec: Specification, transformer: (_: string) => string): Specification {
    return {
        ...spec,
        name: transformer(spec.name),
        params: spec.params.map((p) => transformRefsParam(p, transformer)),
    };
}
