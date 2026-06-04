CREATE TABLE IF NOT EXISTS "campaign_scenario" (
  "id" text PRIMARY KEY NOT NULL,
  "campaignId" text NOT NULL REFERENCES "campaign"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "category" text NOT NULL,
  "messages" jsonb NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "campaign_scenario_campaignId_idx" ON "campaign_scenario" ("campaignId");
