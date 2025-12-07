import "dotenv/config";
import "./sentry.js";

import logger from "@luogu-discussion-archive/logging";

import { worker } from "./worker.js";

process.on("SIGINT", () => {
  logger.info("SIGINT received, closing worker...");
  worker
    .close()
    .then(() => {
      logger.info("Worker closed on SIGINT");
      process.exit(0);
    })
    .catch((err: unknown) => {
      logger.error({ err: err }, "Error closing worker on SIGINT");
      process.exit(1);
    });
});

await worker.run();
