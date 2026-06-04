ALTER TABLE "decision" ADD COLUMN IF NOT EXISTS "auditLog" jsonb DEFAULT '[]'::jsonb NOT NULL;
