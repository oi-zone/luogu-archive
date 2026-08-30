import { pino, type Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;

const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: null,
  redact: {
    paths: [
      "cookie",
      "authorization",
      "headers.cookie",
      "headers.authorization",
      "req.headers.cookie",
      "req.headers.authorization",
      "job.data",
      "data",
      "content",
      "body",
      "response",
    ],
    censor: "[redacted]",
  },
  serializers: {
    err(error: Error) {
      return {
        type: error.name,
        message: error.message.slice(0, 256),
      };
    },
  },
});

export async function closeLogger() {
  // Pino's default destination writes synchronously to process.stdout. There
  // is no application-owned file or remote transport to drain or close.
  await Promise.resolve();
}

export default logger;
