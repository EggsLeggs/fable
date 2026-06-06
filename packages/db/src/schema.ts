import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const fileFormatEnum = pgEnum("file_format", [
  "json_flat",
  "json_nested",
  "po",
  "yaml",
  "lingui_json",
]);

export const sourceTypeEnum = pgEnum("source_type", ["upload", "vcs"]);

export const sourceFileStatusEnum = pgEnum("source_file_status", [
  "active",
  "archived",
]);

export const ingestTriggerEnum = pgEnum("ingest_trigger", [
  "manual_upload",
  "vcs_webhook",
  "vcs_manual_sync",
]);

export const ingestJobStatusEnum = pgEnum("ingest_job_status", [
  "queued",
  "processing",
  "done",
  "failed",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
]);

export const vcsProviderEnum = pgEnum("vcs_provider", ["github"]);

export const vcsPushModeEnum = pgEnum("vcs_push_mode", [
  "pull_request",
  "direct_push",
  "disabled",
]);

export const pushJobStatusEnum = pgEnum("push_job_status", [
  "queued",
  "processing",
  "done",
  "failed",
]);

export const translationKeyStatusEnum = pgEnum("translation_key_status", [
  "active",
  "archived",
]);

export const translationStateEnum = pgEnum("translation_state", [
  "suggested",
  "needs_review",
  "approved",
  "rejected",
]);

export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member", "translator"]);

export const projectVisibilityEnum = pgEnum("project_visibility", [
  "public",
  "private",
]);

export const glossaryAccessEnum = pgEnum("glossary_access", [
  "readonly",
  "suggest",
  "full",
]);

export const planEnum = pgEnum("plan", ["free", "pro", "enterprise"]);

export const planStatusEnum = pgEnum("plan_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
]);

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "annual"]);

export const timeFormatEnum = pgEnum("time_format", ["12h", "24h"]);

export const voteValueEnum = pgEnum("vote_value", ["up", "down"]);

export const profileVisibilityEnum = pgEnum("profile_visibility", [
  "public",
  "private",
]);

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "qualified",
  "rewarded",
]);

export const feedbackPlatformEnum = pgEnum("feedback_platform", [
  "crowdin",
  "lokalise",
  "phrase",
  "other",
]);

export const feedbackSwitchingIntentEnum = pgEnum("feedback_switching_intent", [
  "yes",
  "maybe",
  "no",
]);

export type CustomLocale = { name: string; code: string };

export type SpokenLanguageLevel =
  | "elementary"
  | "limited_working"
  | "professional_working"
  | "full_professional"
  | "native";

export type SpokenLanguage = {
  language: string;
  level: SpokenLanguageLevel;
};

// Better Auth core tables
export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  siteLocale: text("site_locale").notNull().default("en"),
  timezone: text("timezone").notNull().default("UTC"),
  timeFormat: timeFormatEnum("time_format").notNull().default("24h"),
  spokenLanguages: jsonb("spoken_languages")
    .$type<SpokenLanguage[]>()
    .notNull()
    .default([]),
  profileVisibility: profileVisibilityEnum("profile_visibility")
    .notNull()
    .default("private"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
  // Billing - plan belongs to the user, limits apply to their org
  plan: planEnum("plan").notNull().default("free"),
  planStatus: planStatusEnum("plan_status").notNull().default("active"),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planCurrentPeriodEnd: timestamp("plan_current_period_end", { mode: "date" }),
  mtCharsUsed: integer("mt_chars_used").notNull().default(0),
  mtCharsResetAt: timestamp("mt_chars_reset_at", { mode: "date" }),
  mtCharsCap: integer("mt_chars_cap"),
  // Referral program
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  stripeReferralCouponId: text("stripe_referral_coupon_id"),
  lifetimePro: boolean("lifetime_pro").notNull().default(false),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { mode: "date" }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }),
  updatedAt: timestamp("updatedAt", { mode: "date" }),
});

// Fable domain tables
export const organizations = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const orgMembers = pgTable(
  "org_member",
  {
    id: text("id").primaryKey(),
    orgId: text("orgId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.orgId, t.userId)]
);

export const projects = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    orgId: text("orgId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    visibility: projectVisibilityEnum("visibility").notNull().default("private"),
    allowContributions: boolean("allowContributions").notNull().default(false),
    sourceLocale: text("sourceLocale").notNull().default("en"),
    glossaryAccess: glossaryAccessEnum("glossary_access").notNull().default("readonly"),
    notifyTranslatorsOnNewStrings: boolean("notify_translators_on_new_strings").notNull().default(false),
    customLocales: jsonb("custom_locales").$type<CustomLocale[]>().notNull().default([]),
    translatorApprovalRequired: boolean("translator_approval_required").notNull().default(true),
    adminSelfReviewRequired: boolean("admin_self_review_required").notNull().default(false),
    memberInviteToken: text("member_invite_token").unique(),
    memberInviteEnabled: boolean("member_invite_enabled").notNull().default(false),
    translatorInviteToken: text("translator_invite_token").unique(),
    translatorInviteEnabled: boolean("translator_invite_enabled").notNull().default(false),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.orgId, t.slug)]
);

export const projectLocales = pgTable(
  "project_locale",
  {
    id: text("id").primaryKey(),
    projectId: text("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    isSource: boolean("isSource").notNull().default(false),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.projectId, t.locale)]
);

export const githubInstallations = pgTable("github_installation", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  installationId: text("installation_id").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const vcsIntegrations = pgTable("vcs_integration", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  provider: vcsProviderEnum("provider").notNull().default("github"),
  installationId: text("installation_id").notNull(),
  repoOwner: text("repo_owner").notNull(),
  repoName: text("repo_name").notNull(),
  defaultBranch: text("default_branch").notNull().default("main"),
  translationBranch: text("translation_branch")
    .notNull()
    .default("l10n_localise"),
  pushMode: vcsPushModeEnum("push_mode").notNull().default("pull_request"),
  webhookSecret: text("webhook_secret"),
  filePatterns: jsonb("file_patterns").$type<string[]>().notNull().default([]),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const sourceFiles = pgTable(
  "source_file",
  {
    id: text("id").primaryKey(),
    projectId: text("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    path: text("path").notNull(),
    format: fileFormatEnum("format").notNull(),
    formatOverride: fileFormatEnum("format_override"),
    sourceType: sourceTypeEnum("source_type").notNull(),
    vcsIntegrationId: text("vcs_integration_id").references(
      () => vcsIntegrations.id,
      { onDelete: "set null" }
    ),
    vcsPath: text("vcs_path"),
    vcsBranch: text("vcs_branch"),
    rawContent: text("raw_content"),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
    lastPushedAt: timestamp("last_pushed_at", { mode: "date" }),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    translationPattern: text("translation_pattern"),
    status: sourceFileStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.projectId, t.path)]
);

export const pushJobs = pgTable("push_job", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  vcsIntegrationId: text("vcs_integration_id")
    .notNull()
    .references(() => vcsIntegrations.id, { onDelete: "cascade" }),
  locales: jsonb("locales").$type<string[]>().notNull().default([]),
  status: pushJobStatusEnum("status").notNull().default("queued"),
  prUrl: text("pr_url"),
  error: text("error"),
  startedAt: timestamp("started_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const ingestJobs = pgTable("ingest_job", {
  id: text("id").primaryKey(),
  sourceFileId: text("source_file_id")
    .notNull()
    .references(() => sourceFiles.id, { onDelete: "cascade" }),
  trigger: ingestTriggerEnum("trigger").notNull(),
  status: ingestJobStatusEnum("status").notNull().default("queued"),
  stringsAdded: integer("strings_added").notNull().default(0),
  stringsUpdated: integer("strings_updated").notNull().default(0),
  stringsRemoved: integer("strings_removed").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const translationKeys = pgTable(
  "translation_key",
  {
    id: text("id").primaryKey(),
    projectId: text("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    description: text("description"),
    screenshot: text("screenshot"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    sourceFileId: text("source_file_id").references(() => sourceFiles.id, {
      onDelete: "set null",
    }),
    keyHash: text("key_hash"),
    maxLength: integer("max_length"),
    isPlural: boolean("is_plural").notNull().default(false),
    pluralKey: text("plural_key"),
    status: translationKeyStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.projectId, t.key)]
);

export const translations = pgTable("translation", {
  id: text("id").primaryKey(),
  keyId: text("keyId")
    .notNull()
    .references(() => translationKeys.id, { onDelete: "cascade" }),
  locale: text("locale").notNull(),
  value: text("value").notNull(),
  pluralForms: jsonb("plural_forms").$type<Record<string, string>>(),
  state: translationStateEnum("state").notNull().default("needs_review"),
  translatedBy: text("translatedBy").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedBy: text("reviewedBy").references(() => users.id, {
    onDelete: "set null",
  }),
  approvedBy: text("approved_by").references(() => users.id, {
    onDelete: "set null",
  }),
  approvedAt: timestamp("approved_at", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const translationMemory = pgTable("translation_memory", {
  id: text("id").primaryKey(),
  orgId: text("orgId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sourceLocale: text("sourceLocale").notNull(),
  targetLocale: text("targetLocale").notNull(),
  sourceText: text("sourceText").notNull(),
  targetText: text("targetText").notNull(),
  usageCount: integer("usageCount").notNull().default(1),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const glossaryEntries = pgTable("glossary_entry", {
  id: text("id").primaryKey(),
  orgId: text("orgId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sourceLocale: text("sourceLocale").notNull(),
  term: text("term").notNull(),
  definition: text("definition"),
  forbidden: boolean("forbidden").notNull().default(false),
  caseSensitive: boolean("caseSensitive").notNull().default(false),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const glossaryTranslations = pgTable(
  "glossary_translation",
  {
    id: text("id").primaryKey(),
    entryId: text("entryId")
      .notNull()
      .references(() => glossaryEntries.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    translation: text("translation").notNull(),
  },
  (t) => [unique().on(t.entryId, t.locale)]
);

export const webhookConfigs = pgTable("webhook_config", {
  id: text("id").primaryKey(),
  orgId: text("orgId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret"),
  events: jsonb("events").$type<string[]>().notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const tasks = pgTable("task", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  locale: text("locale"),
  sourceFileId: text("source_file_id").references(() => sourceFiles.id, {
    onDelete: "set null",
  }),
  assignedTo: text("assigned_to").references(() => users.id, {
    onDelete: "set null",
  }),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dueDate: timestamp("due_date", { mode: "date" }),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const activityTypeEnum = pgEnum("activity_type", [
  "project_created",
  "project_updated",
  "locale_added",
  "locale_removed",
  "source_created",
  "source_updated",
  "source_deleted",
  "member_joined",
  "member_left",
  "task_created",
  "task_updated",
  "task_deleted",
  "integration_created",
  "integration_updated",
  "integration_deleted",
  "translation_suggested",
  "translation_approved",
  "translation_rejected",
  "translations_pushed",
  "comment_added",
]);

export type ActivityMetadata = {
  name?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  locale?: string;
  sourceId?: string;
  sourcePath?: string;
  memberUserId?: string;
  memberName?: string;
  role?: string;
  taskId?: string;
  taskTitle?: string;
  taskLocale?: string | null;
  taskStatus?: string;
  provider?: string;
  repoOwner?: string;
  repoName?: string;
  keyId?: string;
  keyName?: string;
  translationId?: string;
  translationValue?: string;
  commentId?: string;
  commentBody?: string;
  locales?: string[];
};

export const activityLog = pgTable("activity_log", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  type: activityTypeEnum("type").notNull(),
  locale: text("locale"),
  metadata: jsonb("metadata").$type<ActivityMetadata>().notNull().default({}),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const translationVotes = pgTable(
  "translation_vote",
  {
    id: text("id").primaryKey(),
    translationId: text("translation_id")
      .notNull()
      .references(() => translations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vote: voteValueEnum("vote").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.translationId, t.userId)]
);

export const comments = pgTable("comment", {
  id: text("id").primaryKey(),
  keyId: text("key_id")
    .notNull()
    .references(() => translationKeys.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const commentMentions = pgTable("comment_mention", {
  id: text("id").primaryKey(),
  commentId: text("comment_id")
    .notNull()
    .references(() => comments.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const feedbackResponses = pgTable(
  "feedback_response",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: feedbackPlatformEnum("platform").notNull(),
    otherPlatform: text("other_platform"),
    currentToolRating: integer("current_tool_rating").notNull(),
    likesCurrentTool: text("likes_current_tool").notNull().default(""),
    currentToolFrustration: text("current_tool_frustration").notNull().default(""),
    fableRating: integer("fable_rating").notNull(),
    likesFable: text("likes_fable").notNull().default(""),
    dislikesFable: text("dislikes_fable").notNull().default(""),
    knownBugs: text("known_bugs").notNull().default(""),
    switchingIntent: feedbackSwitchingIntentEnum("switching_intent").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "feedback_response_rating_range",
      sql`${table.currentToolRating} between 1 and 5 and ${table.fableRating} between 1 and 5`,
    ),
    check(
      "feedback_response_other_platform",
      sql`${table.platform}::text = 'other' or ${table.otherPlatform} is null`,
    ),
  ],
);

export const referrals = pgTable(
  "referral",
  {
    id: text("id").primaryKey(),
    referrerId: text("referrer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refereeId: text("referee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: referralStatusEnum("status").notNull().default("pending"),
    qualifiedAt: timestamp("qualified_at", { mode: "date" }),
    rewardedAt: timestamp("rewarded_at", { mode: "date" }),
    rewardMilestone: integer("reward_milestone"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.refereeId)]
);

// Inferred types
export type DbUser = typeof users.$inferSelect;
export type DbOrganization = typeof organizations.$inferSelect;
export type DbOrgMember = typeof orgMembers.$inferSelect;
export type DbProject = typeof projects.$inferSelect;
export type DbProjectLocale = typeof projectLocales.$inferSelect;
export type DbTranslationKey = typeof translationKeys.$inferSelect;
export type DbTranslation = typeof translations.$inferSelect;
export type DbTranslationMemory = typeof translationMemory.$inferSelect;
export type DbGlossaryEntry = typeof glossaryEntries.$inferSelect;
export type DbGithubInstallation = typeof githubInstallations.$inferSelect;
export type DbVcsIntegration = typeof vcsIntegrations.$inferSelect;
export type DbSourceFile = typeof sourceFiles.$inferSelect;
export type DbIngestJob = typeof ingestJobs.$inferSelect;
export type TranslationState = (typeof translationStateEnum.enumValues)[number];
export type OrgRole = (typeof orgRoleEnum.enumValues)[number];
export type ProjectVisibility = (typeof projectVisibilityEnum.enumValues)[number];
export type Plan = (typeof planEnum.enumValues)[number];
export type PlanStatus = (typeof planStatusEnum.enumValues)[number];
export type BillingCycle = (typeof billingCycleEnum.enumValues)[number];
export type TimeFormat = (typeof timeFormatEnum.enumValues)[number];
export type ProfileVisibility = (typeof profileVisibilityEnum.enumValues)[number];
export type FileFormat = (typeof fileFormatEnum.enumValues)[number];
export type SourceType = (typeof sourceTypeEnum.enumValues)[number];
export type IngestJobStatus = (typeof ingestJobStatusEnum.enumValues)[number];
export type IngestTrigger = (typeof ingestTriggerEnum.enumValues)[number];
export type TranslationKeyStatus =
  (typeof translationKeyStatusEnum.enumValues)[number];
export type GlossaryAccess = (typeof glossaryAccessEnum.enumValues)[number];
export type DbTask = typeof tasks.$inferSelect;
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];
export type DbActivityLog = typeof activityLog.$inferSelect;
export type ActivityType = (typeof activityTypeEnum.enumValues)[number];
export type DbTranslationVote = typeof translationVotes.$inferSelect;
export type VoteValue = (typeof voteValueEnum.enumValues)[number];
export type DbPushJob = typeof pushJobs.$inferSelect;
export type PushJobStatus = (typeof pushJobStatusEnum.enumValues)[number];
export type DbComment = typeof comments.$inferSelect;
export type DbCommentMention = typeof commentMentions.$inferSelect;
export type DbReferral = typeof referrals.$inferSelect;
export type ReferralStatus = (typeof referralStatusEnum.enumValues)[number];
export type DbFeedbackResponse = typeof feedbackResponses.$inferSelect;
export type FeedbackPlatform = (typeof feedbackPlatformEnum.enumValues)[number];
export type FeedbackSwitchingIntent = (typeof feedbackSwitchingIntentEnum.enumValues)[number];
