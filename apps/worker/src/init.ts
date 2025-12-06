import { client, Stream } from "@luogu-discussion-archive/redis";

import { GROUP_NAME } from "./config.js";

await client.connect();

await client.xGroupCreate(Stream.Immediate, GROUP_NAME, "0", {
  MKSTREAM: true,
});
await client.xGroupCreate(Stream.Routine, GROUP_NAME, "0", {
  MKSTREAM: true,
});

await client.close();
