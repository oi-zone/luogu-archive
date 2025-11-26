import { readFile } from "node:fs/promises";
import path from "node:path";

import { client } from "@luogu-discussion-archive/redis";

const SCRIPT_SET_IF_LT = await readFile(
  path.join(import.meta.dirname, "../set_if_lt.lua"),
);

export const setIfLt = (key: string, ...args: string[]) =>
  client.eval(SCRIPT_SET_IF_LT, {
    keys: [key],
    arguments: args,
  });
