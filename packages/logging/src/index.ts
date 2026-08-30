import {
  destination as createDestination,
  pino,
  type Logger as PinoLogger,
} from "pino";

export type Logger = PinoLogger;

const destination = createDestination({
  dest: 1,
  minLength: 4_096,
  sync: false,
});

const logger = pino(
  {
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
  },
  destination,
);

export function closeLogger() {
  logger.flush();
  destination.flushSync();
}

export default logger;
