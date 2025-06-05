import * as fs from "fs/promises";
import { ParserState } from "./parser_state";
import { parse } from "./parser";

let input = (await (await fs.open("./sample.idle")).readFile()).toString();

let s = new ParserState(input);
console.log(JSON.stringify(parse(s), null, 2));
