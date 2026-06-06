ALTER TABLE "project" ADD COLUMN "member_invite_token" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "member_invite_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "translator_invite_token" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "translator_invite_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_member_invite_token_unique" UNIQUE("member_invite_token");--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_translator_invite_token_unique" UNIQUE("translator_invite_token");--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN IF EXISTS "member_invite_token";--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN IF EXISTS "member_invite_enabled";--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN IF EXISTS "translator_invite_token";--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN IF EXISTS "translator_invite_enabled";
