import { client, STREAM_KEY, type Task } from "@luogu-discussion-archive/redis";

import { GROUP_NAME } from "./config.js";
import { perform } from "./tasks.js";

export async function consume(consumerName: string) {
  let lastId = "0-0";
  let checkingBacklog = true;

  for (;;) {
    const id = checkingBacklog ? lastId : ">";

    const result = await client.xReadGroup(
      GROUP_NAME,
      consumerName,
      [{ key: STREAM_KEY, id }],
      { BLOCK: 0, COUNT: 1 },
    );

    if (!result) continue;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const messages = result[0]!.messages;

    if (!messages.length) checkingBacklog = false;

    for (const { id, message } of messages) {
      lastId = id;
      await perform(message as unknown as Task);
      await client.xAckDel(STREAM_KEY, GROUP_NAME, id, "ACKED");
    }
  }
}
