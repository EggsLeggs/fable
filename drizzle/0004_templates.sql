CREATE TABLE IF NOT EXISTS "template" (
  "id" text PRIMARY KEY NOT NULL,
  "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "advertiser" text NOT NULL,
  "goal" text DEFAULT '' NOT NULL,
  "maxCPM" real DEFAULT 8 NOT NULL,
  "brandKeywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "blockedTopics" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "template_scenario" (
  "id" text PRIMARY KEY NOT NULL,
  "templateId" text NOT NULL REFERENCES "template"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "category" text NOT NULL,
  "messages" jsonb NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "template_workspaceId_idx" ON "template" ("workspaceId");
CREATE INDEX IF NOT EXISTS "template_scenario_templateId_idx" ON "template_scenario" ("templateId");
