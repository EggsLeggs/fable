import "./env";
import { Worker } from "bullmq";
import { redis } from "./queues";
import { handleMtTranslate } from "./jobs/mt-translate";
import { handleQaCheck } from "./jobs/qa-check";
import { handleVcsSync } from "./jobs/vcs-sync";
import { handleWebhookDelivery } from "./jobs/webhook";

const workers = [
  new Worker("mt-translate", handleMtTranslate, { connection: redis }),
  new Worker("qa-check", handleQaCheck, { connection: redis }),
  new Worker("vcs-sync", handleVcsSync, { connection: redis }),
  new Worker("webhook-delivery", handleWebhookDelivery, { connection: redis }),
];

for (const worker of workers) {
  worker.on("completed", (job) => {
    console.log(`[${job.queueName}] job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[${job?.queueName}] job ${job?.id} failed:`, err.message);
  });
}

console.log("Fable worker started");

process.on("SIGTERM", async () => {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
