ALTER TABLE "organization" ADD COLUMN "member_invite_token" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "member_invite_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "translator_invite_token" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "translator_invite_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_member_invite_token_unique" UNIQUE("member_invite_token");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_translator_invite_token_unique" UNIQUE("translator_invite_token");