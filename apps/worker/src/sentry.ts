import * as Sentry from "@sentry/node";

Sentry.init({
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  dsn: process.env.SENTRY_DSN!,
  sendDefaultPii: true,
  integrations: [Sentry.pinoIntegration()],
  tracesSampler: ({ inheritOrSampleWith, name }) => {
    if (name === "listDiscuss" || name === "listArticles") return 0.1;

    if (name === "discuss") return 0.02;

    if (name === "article") return 0.05;
    if (name === "articleReplies") return 0.02;

    return inheritOrSampleWith(0.2);
  },
  enableLogs: true,
});
