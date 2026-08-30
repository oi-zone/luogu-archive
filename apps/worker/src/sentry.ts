import * as Sentry from "@sentry/node";

const DISABLED_INTEGRATIONS = new Set([
  "Console",
  "Http",
  "LocalVariables",
  "NodeFetch",
  "OnUncaughtException",
  "OnUnhandledRejection",
  "Pino",
  "RequestData",
]);

Sentry.init({
  ...(process.env.SENTRY_DSN ? { dsn: process.env.SENTRY_DSN } : {}),
  enabled: Boolean(process.env.SENTRY_DSN),
  sendDefaultPii: false,
  integrations: (integrations) =>
    integrations.filter(
      (integration) => !DISABLED_INTEGRATIONS.has(integration.name),
    ),
  beforeSend(event) {
    delete event.request;
    delete event.user;
    delete event.breadcrumbs;
    return event;
  },
  tracesSampler: ({ inheritOrSampleWith, name }) => {
    if (name === "listDiscuss" || name === "listArticles") return 0.1;

    if (name === "discuss") return 0.02;

    if (name === "article") return 0.05;
    if (name === "articleReplies") return 0.02;

    return inheritOrSampleWith(0.2);
  },
  enableLogs: false,
});
