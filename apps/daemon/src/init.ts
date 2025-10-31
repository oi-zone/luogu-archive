import {
  client,
  STREAM_IMMEDIATE,
  STREAM_ROUTINE,
} from "@luogu-discussion-archive/redis";

import { GROUP_NAME } from "./config.js";

await client.connect();

await client.xGroupCreate(STREAM_IMMEDIATE, GROUP_NAME, "0", {
  MKSTREAM: true,
});
await client.xGroupCreate(STREAM_ROUTINE, GROUP_NAME, "0", {
  MKSTREAM: true,
});

await client.close();
