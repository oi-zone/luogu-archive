import { Queue } from "bullmq";

import { QUEUE_NAME } from "./config.js";

export const queue = new Queue(QUEUE_NAME, {
  connection: {},
  defaultJobOptions: { attempts: 5 },
});
