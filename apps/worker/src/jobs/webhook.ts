import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { createHmac } from "crypto";
import { db, webhookConfigs } from "@fable/db";

export interface WebhookDeliveryPayload {
  orgId: string;
  event: string;
  payload: Record<string, unknown>;
}

export async function handleWebhookDelivery(
  job: Job<WebhookDeliveryPayload>
): Promise<void> {
  const { orgId, event, payload } = job.data;

  const configs = await db.query.webhookConfigs.findMany({
    where: eq(webhookConfigs.orgId, orgId),
  });

  const enabled = configs.filter(
    (c) =>
      c.enabled &&
      (c.events.length === 0 || c.events.includes(event))
  );

  const body = JSON.stringify({ event, payload, timestamp: Date.now() });

  await Promise.allSettled(
    enabled.map(async (config) => {
      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (config.secret) {
        const sig = createHmac("sha256", config.secret)
          .update(body)
          .digest("hex");
        reqHeaders["X-Fable-Signature"] = `sha256=${sig}`;
      }

      await fetch(config.url, {
        method: "POST",
        headers: reqHeaders,
        body,
      });
    })
  );
}
