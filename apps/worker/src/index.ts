import "./env";
import { Worker } from "bullmq";
import { connection } from "./queues";
import { handleIngest } from "./jobs/ingest";
import { handleMtTranslate } from "./jobs/mt-translate";
import { handleQaCheck } from "./jobs/qa-check";
import { handleVcsSync } from "./jobs/vcs-sync";
import { handleWebhookDelivery } from "./jobs/webhook";

const workers = [
  new Worker("ingest", handleIngest, { connection }),
  new Worker("mt-translate", handleMtTranslate, { connection }),
  new Worker("qa-check", handleQaCheck, { connection }),
  new Worker("vcs-sync", handleVcsSync, { connection }),
  new Worker("webhook-delivery", handleWebhookDelivery, { connection }),
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
