import { Queue } from "bullmq";

function parseRedisOptions(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || "localhost",
      port: parseInt(u.port) || 6379,
      password: u.password || undefined,
      maxRetriesPerRequest: null as null,
    };
  } catch {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null as null };
  }
}

export const connection = parseRedisOptions(
  process.env.REDIS_URL ?? "redis://localhost:6379"
);

export const queues = {
  ingest: new Queue("ingest", { connection }),
  vcsSync: new Queue("vcs-sync", { connection }),
  mtTranslate: new Queue("mt-translate", { connection }),
  qaCheck: new Queue("qa-check", { connection }),
  webhookDelivery: new Queue("webhook-delivery", { connection }),
  pushTranslations: new Queue("push-translations", { connection }),
};
