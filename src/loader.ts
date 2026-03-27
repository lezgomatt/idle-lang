import * as fs from "node:fs";
import { dirname, sep as PATH_SEPARATOR } from "node:path";

import { parse } from "./parser.ts";
import { transformReferences } from "./utils.ts";
import { Definition } from "./types.ts";

export function load(dir: string): Map<string, Definition> {
    let defs = loadUnqualified(listIdleFiles(dir));

    for (let [name, def] of defs.entries()) {
        let mod = name.replace(/\.[^\.]+$/, "");
        defs.set(name, transformReferences(def, (s) => qualifyName(defs, mod, s)));
    }

    return defs;
}

export function* listIdleFiles(dir: string): IterableIterator<[string, string]> {
    let paths = [];
    for (let p of fs.globSync("**/*.idle", { cwd: dir })) {
        paths.push(p);
    }
    paths.sort();

    for (let p of paths) {
        yield [p, fs.readFileSync(p, { encoding: "utf8" })];
    }
}

function loadUnqualified(files: Iterable<[string, string]>): Map<string, Definition> {
    let allDefs = new Map<string, Definition>();

    for (let [path, text] of files) {
        let module = dirname(path).replaceAll(PATH_SEPARATOR, ".");

        for (let def of parse(path, text)) {
            let qualifiedName = (module === ".") ? def.name : `${module}.${def.name}`;
            if (allDefs.has(qualifiedName)) {
                throw new Error(`Duplicate def: ${qualifiedName}`);
            }

            allDefs.set(qualifiedName, def);
        }
    }

    return allDefs;
}

function qualifyName(defs: Map<string, Definition>, mod: string, name: string): string {
    if (mod === "") {
        return name;
    }

    let relativeName = `${mod}.${name}`;
    if (defs.has(relativeName)) {
        return relativeName;
    }

    return name;
}
