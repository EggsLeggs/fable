CREATE TYPE "public"."activity_type" AS ENUM('project_created', 'project_updated', 'locale_added', 'locale_removed', 'source_created', 'source_updated', 'source_deleted', 'member_joined', 'member_left', 'task_created', 'task_updated', 'task_deleted', 'integration_created', 'integration_updated', 'integration_deleted');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."file_format" AS ENUM('json_flat', 'json_nested', 'po', 'yaml', 'lingui_json');--> statement-breakpoint
CREATE TYPE "public"."glossary_access" AS ENUM('readonly', 'suggest', 'full');--> statement-breakpoint
CREATE TYPE "public"."ingest_job_status" AS ENUM('queued', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ingest_trigger" AS ENUM('manual_upload', 'vcs_webhook', 'vcs_manual_sync');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('active', 'trialing', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."profile_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'qualified', 'rewarded');--> statement-breakpoint
CREATE TYPE "public"."source_file_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('upload', 'vcs');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."time_format" AS ENUM('12h', '24h');--> statement-breakpoint
CREATE TYPE "public"."translation_key_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."vcs_provider" AS ENUM('github');--> statement-breakpoint
CREATE TYPE "public"."vcs_push_mode" AS ENUM('pull_request', 'direct_push', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."vote_value" AS ENUM('up', 'down');--> statement-breakpoint
ALTER TYPE "public"."org_role" ADD VALUE 'translator';--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"type" "activity_type" NOT NULL,
	"locale" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_mention" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" text PRIMARY KEY NOT NULL,
	"key_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_installation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_job" (
	"id" text PRIMARY KEY NOT NULL,
	"source_file_id" text NOT NULL,
	"trigger" "ingest_trigger" NOT NULL,
	"status" "ingest_job_status" DEFAULT 'queued' NOT NULL,
	"strings_added" integer DEFAULT 0 NOT NULL,
	"strings_updated" integer DEFAULT 0 NOT NULL,
	"strings_removed" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_id" text NOT NULL,
	"referee_id" text NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"qualified_at" timestamp,
	"rewarded_at" timestamp,
	"reward_milestone" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_referee_id_unique" UNIQUE("referee_id")
);
--> statement-breakpoint
CREATE TABLE "source_file" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"format" "file_format" NOT NULL,
	"source_type" "source_type" NOT NULL,
	"vcs_integration_id" text,
	"vcs_path" text,
	"vcs_branch" text,
	"raw_content" text,
	"last_synced_at" timestamp,
	"last_pushed_at" timestamp,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"status" "source_file_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_file_projectId_path_unique" UNIQUE("projectId","path")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"locale" text,
	"source_file_id" text,
	"assigned_to" text,
	"created_by" text NOT NULL,
	"due_date" timestamp,
	"deleted_at" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation_vote" (
	"id" text PRIMARY KEY NOT NULL,
	"translation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"vote" "vote_value" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "translation_vote_translation_id_user_id_unique" UNIQUE("translation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "vcs_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"provider" "vcs_provider" DEFAULT 'github' NOT NULL,
	"installation_id" text NOT NULL,
	"repo_owner" text NOT NULL,
	"repo_name" text NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"translation_branch" text DEFAULT 'l10n_localise' NOT NULL,
	"push_mode" "vcs_push_mode" DEFAULT 'pull_request' NOT NULL,
	"webhook_secret" text,
	"file_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "translation" DROP CONSTRAINT "translation_keyId_locale_unique";--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "glossary_access" "glossary_access" DEFAULT 'readonly' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "notify_translators_on_new_strings" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "custom_locales" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "translator_approval_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "admin_self_review_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "translation_key" ADD COLUMN "source_file_id" text;--> statement-breakpoint
ALTER TABLE "translation_key" ADD COLUMN "key_hash" text;--> statement-breakpoint
ALTER TABLE "translation_key" ADD COLUMN "max_length" integer;--> statement-breakpoint
ALTER TABLE "translation_key" ADD COLUMN "is_plural" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "translation_key" ADD COLUMN "plural_key" text;--> statement-breakpoint
ALTER TABLE "translation_key" ADD COLUMN "status" "translation_key_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "translation" ADD COLUMN "plural_forms" jsonb;--> statement-breakpoint
ALTER TABLE "translation" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "translation" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "site_locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "time_format" time_format DEFAULT '24h' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "spoken_languages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "profile_visibility" "profile_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "plan" "plan" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "plan_status" "plan_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "plan_current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "mt_chars_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "mt_chars_reset_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "mt_chars_cap" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "referred_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "lifetime_pro" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mention" ADD CONSTRAINT "comment_mention_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mention" ADD CONSTRAINT "comment_mention_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_key_id_translation_key_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."translation_key"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_installation" ADD CONSTRAINT "github_installation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_job" ADD CONSTRAINT "ingest_job_source_file_id_source_file_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_id_user_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referee_id_user_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_file" ADD CONSTRAINT "source_file_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_file" ADD CONSTRAINT "source_file_vcs_integration_id_vcs_integration_id_fk" FOREIGN KEY ("vcs_integration_id") REFERENCES "public"."vcs_integration"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_source_file_id_source_file_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_vote" ADD CONSTRAINT "translation_vote_translation_id_translation_id_fk" FOREIGN KEY ("translation_id") REFERENCES "public"."translation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_vote" ADD CONSTRAINT "translation_vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vcs_integration" ADD CONSTRAINT "vcs_integration_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_key" ADD CONSTRAINT "translation_key_source_file_id_source_file_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation" ADD CONSTRAINT "translation_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_referred_by_user_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_referral_code_unique" UNIQUE("referral_code");