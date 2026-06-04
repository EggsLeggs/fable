import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { DecisionAuditEvent, Message } from "@/lib/store";
import type { ScenarioCategory } from "@/lib/scenario-categories";

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("passwordHash"),
});

export const workspaces = pgTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("ownerId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const campaigns = pgTable("campaign", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  advertiser: text("advertiser").notNull(),
  goal: text("goal").notNull().default(""),
  maxCPM: real("maxCPM").notNull().default(8),
  brandKeywords: jsonb("brandKeywords").$type<string[]>().notNull().default([]),
  blockedTopics: jsonb("blockedTopics").$type<string[]>().notNull().default([]),
  archived: boolean("archived").notNull().default(false),
  starred: boolean("starred").notNull().default(false),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const campaignScenarios = pgTable("campaign_scenario", {
  id: text("id").primaryKey(),
  campaignId: text("campaignId")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  category: text("category").$type<ScenarioCategory>().notNull(),
  messages: jsonb("messages").$type<Message[]>().notNull(),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const templates = pgTable("template", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  advertiser: text("advertiser").notNull(),
  goal: text("goal").notNull().default(""),
  maxCPM: real("maxCPM").notNull().default(8),
  brandKeywords: jsonb("brandKeywords").$type<string[]>().notNull().default([]),
  blockedTopics: jsonb("blockedTopics").$type<string[]>().notNull().default([]),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const templateScenarios = pgTable("template_scenario", {
  id: text("id").primaryKey(),
  templateId: text("templateId")
    .notNull()
    .references(() => templates.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  category: text("category").$type<ScenarioCategory>().notNull(),
  messages: jsonb("messages").$type<Message[]>().notNull(),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type AdReturned = {
  headline: string;
  description: string;
  advertiser: string;
  price: number;
  ctaText: string;
};

export const decisions = pgTable("decision", {
  id: text("id").primaryKey(),
  campaignId: text("campaignId")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  campaignName: text("campaignName").notNull(),
  advertiser: text("advertiser").notNull(),
  contextSnippet: text("contextSnippet").notNull(),
  fullContext: jsonb("fullContext").$type<Message[]>().notNull(),
  decision: text("decision").$type<"bid" | "skip" | "flagged">().notNull(),
  reasoning: text("reasoning").notNull(),
  confidence: integer("confidence").notNull(),
  flags: jsonb("flags").$type<string[]>().notNull().default([]),
  suggestedCPM: real("suggestedCPM"),
  adReturned: jsonb("adReturned").$type<AdReturned>(),
  humanAction: text("humanAction").$type<"approved" | "vetoed" | "flagged">(),
  humanNote: text("humanNote"),
  humanTimestamp: timestamp("humanTimestamp", { mode: "date" }),
  humanRespondedByUserId: text("humanRespondedByUserId").references(() => users.id, {
    onDelete: "set null",
  }),
  auditLog: jsonb("auditLog").$type<DecisionAuditEvent[]>().notNull().default([]),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type DbUser = typeof users.$inferSelect;
export type DbCampaign = typeof campaigns.$inferSelect;
export type DbTemplate = typeof templates.$inferSelect;
export type DbWorkspace = typeof workspaces.$inferSelect;
export type DbCampaignScenario = typeof campaignScenarios.$inferSelect;
export type DbTemplateScenario = typeof templateScenarios.$inferSelect;
export type DbDecision = typeof decisions.$inferSelect;
