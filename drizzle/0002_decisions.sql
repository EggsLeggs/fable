CREATE TABLE IF NOT EXISTS "decision" (
  "id" text PRIMARY KEY NOT NULL,
  "campaignId" text NOT NULL REFERENCES "campaign"("id") ON DELETE CASCADE,
  "campaignName" text NOT NULL,
  "advertiser" text NOT NULL,
  "contextSnippet" text NOT NULL,
  "fullContext" jsonb NOT NULL,
  "decision" text NOT NULL,
  "reasoning" text NOT NULL,
  "confidence" integer NOT NULL,
  "flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "suggestedCPM" real,
  "adReturned" jsonb,
  "humanAction" text,
  "humanNote" text,
  "humanTimestamp" timestamp,
  "humanRespondedByUserId" text REFERENCES "user"("id") ON DELETE SET NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "decision_campaignId_idx" ON "decision" ("campaignId");
CREATE INDEX IF NOT EXISTS "decision_campaignId_createdAt_idx" ON "decision" ("campaignId", "createdAt" DESC);
