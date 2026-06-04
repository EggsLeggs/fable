import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const translationStateEnum = pgEnum("translation_state", [
  "suggested",
  "needs_review",
  "approved",
  "rejected",
]);

export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member"]);

export const projectVisibilityEnum = pgEnum("project_visibility", [
  "public",
  "private",
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

export const profileVisibilityEnum = pgEnum("profile_visibility", [
  "public",
  "private",
]);

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
  // Billing — plan belongs to the user, limits apply to their org
  plan: planEnum("plan").notNull().default("free"),
  planStatus: planStatusEnum("plan_status").notNull().default("active"),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planCurrentPeriodEnd: timestamp("plan_current_period_end", { mode: "date" }),
  mtCharsUsed: integer("mt_chars_used").notNull().default(0),
  mtCharsResetAt: timestamp("mt_chars_reset_at", { mode: "date" }),
  mtCharsCap: integer("mt_chars_cap"),
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
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.projectId, t.key)]
);

export const translations = pgTable(
  "translation",
  {
    id: text("id").primaryKey(),
    keyId: text("keyId")
      .notNull()
      .references(() => translationKeys.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    value: text("value").notNull(),
    state: translationStateEnum("state").notNull().default("needs_review"),
    translatedBy: text("translatedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedBy: text("reviewedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.keyId, t.locale)]
);

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
export type TranslationState = (typeof translationStateEnum.enumValues)[number];
export type OrgRole = (typeof orgRoleEnum.enumValues)[number];
export type ProjectVisibility = (typeof projectVisibilityEnum.enumValues)[number];
export type Plan = (typeof planEnum.enumValues)[number];
export type PlanStatus = (typeof planStatusEnum.enumValues)[number];
export type BillingCycle = (typeof billingCycleEnum.enumValues)[number];
export type TimeFormat = (typeof timeFormatEnum.enumValues)[number];
export type ProfileVisibility = (typeof profileVisibilityEnum.enumValues)[number];
