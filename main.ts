import * as fs from "fs/promises";
import { TokenStream } from "./lexer";
import { parse } from "./parser";

let input = (await (await fs.open("./sample.idle")).readFile()).toString();

let s = new TokenStream("sample", input);
console.log(JSON.stringify(parse(s), null, 2));
