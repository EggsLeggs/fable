import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const redis = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);

export const queues = {
  vcsSync: new Queue("vcs-sync", { connection: redis }),
  mtTranslate: new Queue("mt-translate", { connection: redis }),
  qaCheck: new Queue("qa-check", { connection: redis }),
  webhookDelivery: new Queue("webhook-delivery", { connection: redis }),
};
