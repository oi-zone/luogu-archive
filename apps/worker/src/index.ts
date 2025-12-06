import "dotenv/config";
import "./sentry.js";

import logger from "@luogu-discussion-archive/logging";
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
    const log = logger.child({ consumer: name });
    log.info({ consumer: name }, "Starting consumer");
    return consume(name).catch((err: unknown) => {
      log.fatal({ consumer: name, err }, "Consumer crashed");
      throw err;
    });
  }),
);

await client.close();
