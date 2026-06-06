import { pgTable, unique, text, timestamp, foreignKey, jsonb, integer, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const activityType = pgEnum("activity_type", ['project_created', 'project_updated', 'locale_added', 'locale_removed', 'source_created', 'source_updated', 'source_deleted', 'member_joined', 'member_left', 'task_created', 'task_updated', 'task_deleted', 'integration_created', 'integration_updated', 'integration_deleted', 'translation_suggested', 'translation_approved', 'translation_rejected', 'translations_pushed', 'comment_added'])
export const billingCycle = pgEnum("billing_cycle", ['monthly', 'annual'])
export const fileFormat = pgEnum("file_format", ['json_flat', 'json_nested', 'po', 'yaml', 'lingui_json'])
export const glossaryAccess = pgEnum("glossary_access", ['readonly', 'suggest', 'full'])
export const ingestJobStatus = pgEnum("ingest_job_status", ['queued', 'processing', 'done', 'failed'])
export const ingestTrigger = pgEnum("ingest_trigger", ['manual_upload', 'vcs_webhook', 'vcs_manual_sync'])
export const orgRole = pgEnum("org_role", ['owner', 'admin', 'member', 'translator'])
export const plan = pgEnum("plan", ['free', 'pro', 'enterprise'])
export const planStatus = pgEnum("plan_status", ['active', 'trialing', 'past_due', 'canceled'])
export const profileVisibility = pgEnum("profile_visibility", ['public', 'private'])
export const projectVisibility = pgEnum("project_visibility", ['public', 'private'])
export const pushJobStatus = pgEnum("push_job_status", ['queued', 'processing', 'done', 'failed'])
export const referralStatus = pgEnum("referral_status", ['pending', 'qualified', 'rewarded'])
export const sourceFileStatus = pgEnum("source_file_status", ['active', 'archived'])
export const sourceType = pgEnum("source_type", ['upload', 'vcs'])
export const taskStatus = pgEnum("task_status", ['todo', 'in_progress', 'done'])
export const timeFormat = pgEnum("time_format", ['12h', '24h'])
export const translationKeyStatus = pgEnum("translation_key_status", ['active', 'archived'])
export const translationState = pgEnum("translation_state", ['suggested', 'needs_review', 'approved', 'rejected'])
export const vcsProvider = pgEnum("vcs_provider", ['github'])
export const vcsPushMode = pgEnum("vcs_push_mode", ['pull_request', 'direct_push', 'disabled'])
export const voteValue = pgEnum("vote_value", ['up', 'down'])


export const organization = pgTable("organization", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("organization_slug_unique").on(table.slug),
]);

export const glossaryTranslation = pgTable("glossary_translation", {
	id: text().primaryKey().notNull(),
	entryId: text().notNull(),
	locale: text().notNull(),
	translation: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.entryId],
			foreignColumns: [glossaryEntry.id],
			name: "glossary_translation_entryId_glossary_entry_id_fk"
		}).onDelete("cascade"),
	unique("glossary_translation_entryId_locale_unique").on(table.entryId, table.locale),
]);

export const orgMember = pgTable("org_member", {
	id: text().primaryKey().notNull(),
	orgId: text().notNull(),
	userId: text().notNull(),
	role: orgRole().default('member').notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organization.id],
			name: "org_member_orgId_organization_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "org_member_userId_user_id_fk"
		}).onDelete("cascade"),
	unique("org_member_orgId_userId_unique").on(table.orgId, table.userId),
]);

export const translationKey = pgTable("translation_key", {
	id: text().primaryKey().notNull(),
	projectId: text().notNull(),
	key: text().notNull(),
	description: text(),
	screenshot: text(),
	tags: jsonb().default([]).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	sourceFileId: text("source_file_id"),
	keyHash: text("key_hash"),
	maxLength: integer("max_length"),
	isPlural: boolean("is_plural").default(false).notNull(),
	pluralKey: text("plural_key"),
	status: translationKeyStatus().default('active').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [project.id],
			name: "translation_key_projectId_project_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sourceFileId],
			foreignColumns: [sourceFile.id],
			name: "translation_key_source_file_id_source_file_id_fk"
		}).onDelete("set null"),
	unique("translation_key_projectId_key_unique").on(table.projectId, table.key),
]);

export const projectLocale = pgTable("project_locale", {
	id: text().primaryKey().notNull(),
	projectId: text().notNull(),
	locale: text().notNull(),
	isSource: boolean().default(false).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [project.id],
			name: "project_locale_projectId_project_id_fk"
		}).onDelete("cascade"),
	unique("project_locale_projectId_locale_unique").on(table.projectId, table.locale),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	ipAddress: text(),
	userAgent: text(),
	userId: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_userId_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const project = pgTable("project", {
	id: text().primaryKey().notNull(),
	orgId: text().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	visibility: projectVisibility().default('private').notNull(),
	allowContributions: boolean().default(false).notNull(),
	sourceLocale: text().default('en').notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	glossaryAccess: glossaryAccess("glossary_access").default('readonly').notNull(),
	notifyTranslatorsOnNewStrings: boolean("notify_translators_on_new_strings").default(false).notNull(),
	customLocales: jsonb("custom_locales").default([]).notNull(),
	translatorApprovalRequired: boolean("translator_approval_required").default(true).notNull(),
	adminSelfReviewRequired: boolean("admin_self_review_required").default(false).notNull(),
	memberInviteToken: text("member_invite_token"),
	memberInviteEnabled: boolean("member_invite_enabled").default(false).notNull(),
	translatorInviteToken: text("translator_invite_token"),
	translatorInviteEnabled: boolean("translator_invite_enabled").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organization.id],
			name: "project_orgId_organization_id_fk"
		}).onDelete("cascade"),
	unique("project_orgId_slug_unique").on(table.orgId, table.slug),
	unique("project_member_invite_token_unique").on(table.memberInviteToken),
	unique("project_translator_invite_token_unique").on(table.translatorInviteToken),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text().notNull(),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp({ mode: 'string' }),
	refreshTokenExpiresAt: timestamp({ mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_userId_user_id_fk"
		}).onDelete("cascade"),
]);

export const translation = pgTable("translation", {
	id: text().primaryKey().notNull(),
	keyId: text().notNull(),
	locale: text().notNull(),
	value: text().notNull(),
	state: translationState().default('needs_review').notNull(),
	translatedBy: text(),
	reviewedBy: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	pluralForms: jsonb("plural_forms"),
	approvedBy: text("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [translationKey.id],
			name: "translation_keyId_translation_key_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.translatedBy],
			foreignColumns: [user.id],
			name: "translation_translatedBy_user_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [user.id],
			name: "translation_reviewedBy_user_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [user.id],
			name: "translation_approved_by_user_id_fk"
		}).onDelete("set null"),
]);

export const translationMemory = pgTable("translation_memory", {
	id: text().primaryKey().notNull(),
	orgId: text().notNull(),
	sourceLocale: text().notNull(),
	targetLocale: text().notNull(),
	sourceText: text().notNull(),
	targetText: text().notNull(),
	usageCount: integer().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organization.id],
			name: "translation_memory_orgId_organization_id_fk"
		}).onDelete("cascade"),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean().default(false).notNull(),
	image: text(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	username: text(),
	siteLocale: text("site_locale").default('en').notNull(),
	timezone: text().default('UTC').notNull(),
	timeFormat: timeFormat("time_format").default('24h').notNull(),
	spokenLanguages: jsonb("spoken_languages").default([]).notNull(),
	profileVisibility: profileVisibility("profile_visibility").default('private').notNull(),
	plan: plan().default('free').notNull(),
	planStatus: planStatus("plan_status").default('active').notNull(),
	billingCycle: billingCycle("billing_cycle").default('monthly').notNull(),
	stripeCustomerId: text("stripe_customer_id"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	planCurrentPeriodEnd: timestamp("plan_current_period_end", { mode: 'string' }),
	mtCharsUsed: integer("mt_chars_used").default(0).notNull(),
	mtCharsResetAt: timestamp("mt_chars_reset_at", { mode: 'string' }),
	mtCharsCap: integer("mt_chars_cap"),
	referralCode: text("referral_code"),
	referredBy: text("referred_by"),
	stripeReferralCouponId: text("stripe_referral_coupon_id"),
	lifetimePro: boolean("lifetime_pro").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.referredBy],
			foreignColumns: [table.id],
			name: "user_referred_by_user_id_fk"
		}).onDelete("set null"),
	unique("user_email_unique").on(table.email),
	unique("user_username_unique").on(table.username),
	unique("user_referral_code_unique").on(table.referralCode),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }),
	updatedAt: timestamp({ mode: 'string' }),
});

export const glossaryEntry = pgTable("glossary_entry", {
	id: text().primaryKey().notNull(),
	orgId: text().notNull(),
	sourceLocale: text().notNull(),
	term: text().notNull(),
	definition: text(),
	forbidden: boolean().default(false).notNull(),
	caseSensitive: boolean().default(false).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organization.id],
			name: "glossary_entry_orgId_organization_id_fk"
		}).onDelete("cascade"),
]);

export const webhookConfig = pgTable("webhook_config", {
	id: text().primaryKey().notNull(),
	orgId: text().notNull(),
	url: text().notNull(),
	secret: text(),
	events: jsonb().default([]).notNull(),
	enabled: boolean().default(true).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organization.id],
			name: "webhook_config_orgId_organization_id_fk"
		}).onDelete("cascade"),
]);

export const comment = pgTable("comment", {
	id: text().primaryKey().notNull(),
	keyId: text("key_id").notNull(),
	authorId: text("author_id").notNull(),
	body: text().notNull(),
	resolved: boolean().default(false).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [translationKey.id],
			name: "comment_key_id_translation_key_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "comment_author_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const githubInstallation = pgTable("github_installation", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	installationId: text("installation_id").notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "github_installation_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const ingestJob = pgTable("ingest_job", {
	id: text().primaryKey().notNull(),
	sourceFileId: text("source_file_id").notNull(),
	trigger: ingestTrigger().notNull(),
	status: ingestJobStatus().default('queued').notNull(),
	stringsAdded: integer("strings_added").default(0).notNull(),
	stringsUpdated: integer("strings_updated").default(0).notNull(),
	stringsRemoved: integer("strings_removed").default(0).notNull(),
	error: text(),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sourceFileId],
			foreignColumns: [sourceFile.id],
			name: "ingest_job_source_file_id_source_file_id_fk"
		}).onDelete("cascade"),
]);

export const pushJob = pgTable("push_job", {
	id: text().primaryKey().notNull(),
	projectId: text("project_id").notNull(),
	vcsIntegrationId: text("vcs_integration_id").notNull(),
	locales: jsonb().default([]).notNull(),
	status: pushJobStatus().default('queued').notNull(),
	prUrl: text("pr_url"),
	error: text(),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [project.id],
			name: "push_job_project_id_project_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.vcsIntegrationId],
			foreignColumns: [vcsIntegration.id],
			name: "push_job_vcs_integration_id_vcs_integration_id_fk"
		}).onDelete("cascade"),
]);

export const referral = pgTable("referral", {
	id: text().primaryKey().notNull(),
	referrerId: text("referrer_id").notNull(),
	refereeId: text("referee_id").notNull(),
	status: referralStatus().default('pending').notNull(),
	qualifiedAt: timestamp("qualified_at", { mode: 'string' }),
	rewardedAt: timestamp("rewarded_at", { mode: 'string' }),
	rewardMilestone: integer("reward_milestone"),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.referrerId],
			foreignColumns: [user.id],
			name: "referral_referrer_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.refereeId],
			foreignColumns: [user.id],
			name: "referral_referee_id_user_id_fk"
		}).onDelete("cascade"),
	unique("referral_referee_id_unique").on(table.refereeId),
]);

export const activityLog = pgTable("activity_log", {
	id: text().primaryKey().notNull(),
	projectId: text("project_id").notNull(),
	userId: text("user_id"),
	type: activityType().notNull(),
	locale: text(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [project.id],
			name: "activity_log_project_id_project_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "activity_log_user_id_user_id_fk"
		}).onDelete("set null"),
]);

export const translationVote = pgTable("translation_vote", {
	id: text().primaryKey().notNull(),
	translationId: text("translation_id").notNull(),
	userId: text("user_id").notNull(),
	vote: voteValue().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.translationId],
			foreignColumns: [translation.id],
			name: "translation_vote_translation_id_translation_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "translation_vote_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("translation_vote_translation_id_user_id_unique").on(table.translationId, table.userId),
]);

export const task = pgTable("task", {
	id: text().primaryKey().notNull(),
	projectId: text().notNull(),
	title: text().notNull(),
	description: text(),
	status: taskStatus().default('todo').notNull(),
	locale: text(),
	sourceFileId: text("source_file_id"),
	assignedTo: text("assigned_to"),
	createdBy: text("created_by").notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [project.id],
			name: "task_projectId_project_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sourceFileId],
			foreignColumns: [sourceFile.id],
			name: "task_source_file_id_source_file_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [user.id],
			name: "task_assigned_to_user_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "task_created_by_user_id_fk"
		}).onDelete("cascade"),
]);

export const commentMention = pgTable("comment_mention", {
	id: text().primaryKey().notNull(),
	commentId: text("comment_id").notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.commentId],
			foreignColumns: [comment.id],
			name: "comment_mention_comment_id_comment_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "comment_mention_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const sourceFile = pgTable("source_file", {
	id: text().primaryKey().notNull(),
	projectId: text().notNull(),
	name: text().notNull(),
	path: text().notNull(),
	format: fileFormat().notNull(),
	formatOverride: fileFormat("format_override"),
	sourceType: sourceType("source_type").notNull(),
	vcsIntegrationId: text("vcs_integration_id"),
	vcsPath: text("vcs_path"),
	vcsBranch: text("vcs_branch"),
	rawContent: text("raw_content"),
	lastSyncedAt: timestamp("last_synced_at", { mode: 'string' }),
	lastPushedAt: timestamp("last_pushed_at", { mode: 'string' }),
	pushEnabled: boolean("push_enabled").default(true).notNull(),
	translationPattern: text("translation_pattern"),
	status: sourceFileStatus().default('active').notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [project.id],
			name: "source_file_projectId_project_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.vcsIntegrationId],
			foreignColumns: [vcsIntegration.id],
			name: "source_file_vcs_integration_id_vcs_integration_id_fk"
		}).onDelete("set null"),
	unique("source_file_projectId_path_unique").on(table.projectId, table.path),
]);

export const vcsIntegration = pgTable("vcs_integration", {
	id: text().primaryKey().notNull(),
	projectId: text().notNull(),
	provider: vcsProvider().default('github').notNull(),
	installationId: text("installation_id").notNull(),
	repoOwner: text("repo_owner").notNull(),
	repoName: text("repo_name").notNull(),
	defaultBranch: text("default_branch").default('main').notNull(),
	translationBranch: text("translation_branch").default('l10n_localise').notNull(),
	pushMode: vcsPushMode("push_mode").default('pull_request').notNull(),
	webhookSecret: text("webhook_secret"),
	filePatterns: jsonb("file_patterns").default([]).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [project.id],
			name: "vcs_integration_projectId_project_id_fk"
		}).onDelete("cascade"),
]);
