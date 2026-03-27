import { Definition, Flag, Literal, Parameter, Property, Specification } from "./types.ts";

export function transformReferences(def: Definition, transformer: (origName: string) => string): Definition {
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

interface ParameterSignature<T> {
    type: (_: Specification | Literal) => T,
    default?: T, // default = required; only valid for non-positional (AKA keyword) arguments
    positional?: boolean, // default = false
    multiple?: boolean, // default = false; only valid for the last positional argument
}

type ParamsObject<S> = {
    [K in keyof S]:
        S[K] extends ParameterSignature<infer T>
            ? S[K] extends { multiple: true } ? T[] : T
        : never;
};

export function processParams<S extends Record<string, ParameterSignature<any>>>(params: Parameter[], schema: S): ParamsObject<S> {
    let result: Record<string, unknown> = {};

    let signatures = Object.entries(schema);
    let kwSigStart = signatures.findIndex(([_, s]) => !(s.positional ?? false));
    let posSignatures = signatures.slice(0, kwSigStart);
    let kwSignatures = signatures.slice(kwSigStart);

    let varSignature = null;
    if (posSignatures.length > 0 && posSignatures.at(-1)![1].multiple) {
        varSignature = posSignatures.pop() ?? null;
    }

    if (!(
        posSignatures.every(([_, s]) => !("default" in s))
        && posSignatures.every(([_, s]) => !(s.multiple ?? false))
        && kwSignatures.every(([_, s]) => !(s.positional ?? false) && !(s.multiple ?? false))
        && (varSignature == null || !("default" in varSignature))
    )) {
        // FIXME
        throw new Error("...");
    }

    let kwParamStart = params.findIndex((p) => p.name != null);
    let posParams = params.slice(0, kwParamStart);
    let kwParams = params.slice(kwParamStart);

    let varParams: Parameter[] = [];
    if (varSignature != null && posParams.length > posSignatures.length) {
        varParams = posParams.slice(posSignatures.length);
        posParams = posParams.slice(0, posSignatures.length);
    }

    if (!(
        posParams.length === posSignatures.length
        && kwParams.every((p) => p.name != null && kwSignatures.some(([kw, _]) => p.name === kw))
    )) {
        // FIXME
        throw new Error("...");
    }

    for (let i = 0; i < posSignatures.length; i++) {
        let [name, sig] = posSignatures[1];
        result[name] = sig.type(posParams[i].value);
    }

    if (varSignature != null) {
        let [name, sig] = varSignature;
        result[name] = varParams.map((p) => sig.type(p.value));
    }

    for (let [name, sig] of kwSignatures) {
        let param = kwParams.find((p) => p.name === name);
        if (param == null) {
            if ("default" in sig) {
                result[name] = sig.default;
            } else {
                // FIXME
                throw new Error("...");
            }
        } else {
            result[name] = sig.type(param.value);
        }
    }

    return result as ParamsObject<S>;
}

interface FlagSignature {
    params?: Record<string, ParameterSignature<any>>, // default = treat as a boolean flag
    multiple?: boolean, // default = false; only valid for non-boolean flags
}

type FlagsObject<S> = {
  [K in keyof S]:
    S[K] extends FlagSignature
        ? S[K] extends { params: infer P }
            ? S[K] extends { multiple: true } ? ParamsObject<P>[] : (ParamsObject<P> | null)
        : boolean
    : never;
};

export function processFlags<S extends Record<string, FlagSignature>>(flags: Flag[], schema: S): FlagsObject<S> {
    let result: Record<string, unknown> = {};

    let signatures = Object.entries(schema);

    if (!(
        signatures.every(([_, s]) => "params" in s || !(s.multiple ?? false))
        && flags.every((f) => f.name in schema)
    )) {
        // FIXME
        throw new Error("...");
    }

    for (let [name, sig] of signatures) {
        let matches = flags.filter((f) => f.name === name);

        let isBooleanFlag = !("params" in sig);
        if (isBooleanFlag) {
            switch (matches.length) {
            case 0:
                result[name] = false;
                break;
            case 1:
                if (matches[0].params.length !== 0) {
                    // FIXME
                    throw new Error("...");
                }

                result[name] = true;
                break;
            default:
                // FIXME
                throw new Error("...");
            }
        } else {
            if (sig.multiple) {
                result[name] = matches.map((f) => processParams(f.params, sig.params!));
            } else {
                switch (matches.length) {
                case 0:
                    result[name] = null;
                    break;
                case 1:
                    result[name] = processParams(matches[0].params, sig.params!);
                    break;
                default:
                    // FIXME
                    throw new Error("...");
                }
            }
        }
    }

    return result as FlagsObject<S>;
}
