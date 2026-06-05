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

const connection = parseRedisOptions(
  process.env.REDIS_URL ?? "redis://localhost:6379"
);

let ingestQueue: Queue | null = null;

export function getIngestQueue(): Queue {
  if (!ingestQueue) {
    ingestQueue = new Queue("ingest", { connection });
  }
  return ingestQueue;
}
