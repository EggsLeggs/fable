CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "email" text NOT NULL UNIQUE,
  "emailVerified" timestamp,
  "image" text,
  "passwordHash" text
);

CREATE TABLE IF NOT EXISTS "workspace" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "ownerId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "campaign" (
  "id" text PRIMARY KEY NOT NULL,
  "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "advertiser" text NOT NULL,
  "goal" text DEFAULT '' NOT NULL,
  "maxCPM" real DEFAULT 8 NOT NULL,
  "brandKeywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "blockedTopics" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "starred" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
