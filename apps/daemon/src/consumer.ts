import {
  client,
  STREAM_IMMEDIATE,
  STREAM_ROUTINE,
  type Task,
} from "@luogu-discussion-archive/redis";

import { BLOCK_IMM_MS, GROUP_NAME } from "./config.js";
import { perform } from "./tasks.js";

export async function consume(consumerName: string) {
  const lastId = { [STREAM_IMMEDIATE]: "0-0", [STREAM_ROUTINE]: "0-0" };
  const checkingBacklog = { [STREAM_IMMEDIATE]: true, [STREAM_ROUTINE]: true };

  for (;;) {
    let result = await client.xReadGroup(
      GROUP_NAME,
      consumerName,
      [
        {
          key: STREAM_IMMEDIATE,
          id: checkingBacklog[STREAM_IMMEDIATE]
            ? lastId[STREAM_IMMEDIATE]
            : ">",
        },
      ],
      { BLOCK: BLOCK_IMM_MS, COUNT: 1 },
    );

    result ??= await client.xReadGroup(
      GROUP_NAME,
      consumerName,
      [
        {
          key: STREAM_ROUTINE,
          id: checkingBacklog[STREAM_ROUTINE] ? lastId[STREAM_ROUTINE] : ">",
        },
      ],
      { COUNT: 1 },
    );

    if (!result) continue;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { name, messages } = result[0]!;
    const stream = name as typeof STREAM_IMMEDIATE | typeof STREAM_ROUTINE;

    if (!messages.length) checkingBacklog[stream] = false;

    for (const { id, message } of messages) {
      await perform(message as unknown as Task, stream);
      await client.xAckDel(stream, GROUP_NAME, id, "ACKED");
      lastId[stream] = id;
    }
  }
}
