import { Queue } from "bullmq";

import { QUEUE_NAME } from "./config.js";
import type { Job } from "./jobs.js";

export const queue = new Queue<Job>(QUEUE_NAME, {
  connection: {},
  defaultJobOptions: { attempts: 5 },
});
