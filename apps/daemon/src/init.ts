import { client, STREAM_KEY } from "@luogu-discussion-archive/redis";

import { GROUP_NAME } from "./config.js";

await client.connect();

await client.xGroupCreate(STREAM_KEY, GROUP_NAME, "0", {
  MKSTREAM: true,
});

await client.close();
