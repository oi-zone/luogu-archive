/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import path = require("node:path");

import pino = require("pino");

namespace logger {
  export type Logger = pino.Logger;
}

const production = process.env.NODE_ENV === "production";

const logger = pino(
  production ? { level: "info" } : { level: "debug" },
  pino.transport(
    production
      ? {
          targets: [
            {
              target: "pino/file",
              options: { destination: path.join(process.cwd(), "server.log") },
            },
            {
              target: "@logtail/pino",
              options: {
                sourceToken: process.env.LOGTAIL_SOURCE_TOKEN,
                options: { endpoint: process.env.LOGTAIL_ENDPOINT },
              },
            },
          ],
        }
      : { target: "pino-pretty" },
  ),
);
export = logger;
