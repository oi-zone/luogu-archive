import { client } from "@luogu-discussion-archive/redis";

import { consume } from "./consumer.js";

const consumers = process.argv.slice(2);

if (!consumers.length) {
  console.error("Consumer name is required as the first argument.");
  process.exit(1);
}

await client.connect();

await Promise.all(
  consumers.map((name) => {
    const start = (): Promise<void> =>
      consume(name).catch(() =>
        new Promise((resolve) => setTimeout(resolve, 10000)).then(start),
      );
    return start();
  }),
);

await client.close();
