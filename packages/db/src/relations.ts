import { relations } from "drizzle-orm";
import {
  users,
  organizations,
  orgMembers,
  projects,
  projectLocales,
  translationKeys,
  translations,
  translationMemory,
  glossaryEntries,
  glossaryTranslations,
  webhookConfigs,
  githubInstallations,
  vcsIntegrations,
  sourceFiles,
  ingestJobs,
  pushJobs,
  tasks,
  activityLog,
  translationVotes,
  comments,
  commentMentions,
  referrals,
  feedbackResponses,
} from "./schema";

export const usersRelations = relations(users, ({ many, one }) => ({
  orgMemberships: many(orgMembers),
  translationsAuthored: many(translations, { relationName: "translator" }),
  translationsReviewed: many(translations, { relationName: "reviewer" }),
  translationsApproved: many(translations, { relationName: "approver" }),
  githubInstallations: many(githubInstallations),
  tasksAssigned: many(tasks, { relationName: "task_assignee" }),
  tasksCreated: many(tasks, { relationName: "task_creator" }),
  translationVotes: many(translationVotes),
  comments: many(comments, { relationName: "comment_author" }),
  commentMentions: many(commentMentions),
  referralsMade: many(referrals, { relationName: "referrer" }),
  feedbackResponse: one(feedbackResponses, {
    fields: [users.id],
    references: [feedbackResponses.userId],
  }),
}));

export const githubInstallationsRelations = relations(
  githubInstallations,
  ({ one }) => ({
    user: one(users, {
      fields: [githubInstallations.userId],
      references: [users.id],
    }),
  })
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  projects: many(projects),
  translationMemory: many(translationMemory),
  glossaryEntries: many(glossaryEntries),
  webhookConfigs: many(webhookConfigs),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org: one(organizations, {
    fields: [orgMembers.orgId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [orgMembers.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  org: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
  locales: many(projectLocales),
  keys: many(translationKeys),
  sourceFiles: many(sourceFiles),
  vcsIntegrations: many(vcsIntegrations),
  tasks: many(tasks),
  activityLogs: many(activityLog),
}));

export const projectLocalesRelations = relations(projectLocales, ({ one }) => ({
  project: one(projects, {
    fields: [projectLocales.projectId],
    references: [projects.id],
  }),
}));

export const translationKeysRelations = relations(
  translationKeys,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [translationKeys.projectId],
      references: [projects.id],
    }),
    translations: many(translations),
    sourceFile: one(sourceFiles, {
      fields: [translationKeys.sourceFileId],
      references: [sourceFiles.id],
    }),
    comments: many(comments),
  })
);

export const vcsIntegrationsRelations = relations(
  vcsIntegrations,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [vcsIntegrations.projectId],
      references: [projects.id],
    }),
    sourceFiles: many(sourceFiles),
    pushJobs: many(pushJobs),
  })
);

export const pushJobsRelations = relations(pushJobs, ({ one }) => ({
  project: one(projects, {
    fields: [pushJobs.projectId],
    references: [projects.id],
  }),
  vcsIntegration: one(vcsIntegrations, {
    fields: [pushJobs.vcsIntegrationId],
    references: [vcsIntegrations.id],
  }),
}));

export const sourceFilesRelations = relations(
  sourceFiles,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [sourceFiles.projectId],
      references: [projects.id],
    }),
    vcsIntegration: one(vcsIntegrations, {
      fields: [sourceFiles.vcsIntegrationId],
      references: [vcsIntegrations.id],
    }),
    ingestJobs: many(ingestJobs),
    keys: many(translationKeys),
    tasks: many(tasks),
  })
);

export const ingestJobsRelations = relations(ingestJobs, ({ one }) => ({
  sourceFile: one(sourceFiles, {
    fields: [ingestJobs.sourceFileId],
    references: [sourceFiles.id],
  }),
}));

export const translationsRelations = relations(translations, ({ one, many }) => ({
  key: one(translationKeys, {
    fields: [translations.keyId],
    references: [translationKeys.id],
  }),
  translatedByUser: one(users, {
    fields: [translations.translatedBy],
    references: [users.id],
    relationName: "translator",
  }),
  reviewedByUser: one(users, {
    fields: [translations.reviewedBy],
    references: [users.id],
    relationName: "reviewer",
  }),
  approvedByUser: one(users, {
    fields: [translations.approvedBy],
    references: [users.id],
    relationName: "approver",
  }),
  votes: many(translationVotes),
}));

export const translationVotesRelations = relations(translationVotes, ({ one }) => ({
  translation: one(translations, {
    fields: [translationVotes.translationId],
    references: [translations.id],
  }),
  user: one(users, {
    fields: [translationVotes.userId],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  key: one(translationKeys, {
    fields: [comments.keyId],
    references: [translationKeys.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
    relationName: "comment_author",
  }),
  mentions: many(commentMentions),
}));

export const commentMentionsRelations = relations(commentMentions, ({ one }) => ({
  comment: one(comments, {
    fields: [commentMentions.commentId],
    references: [comments.id],
  }),
  user: one(users, {
    fields: [commentMentions.userId],
    references: [users.id],
  }),
}));

export const translationMemoryRelations = relations(
  translationMemory,
  ({ one }) => ({
    org: one(organizations, {
      fields: [translationMemory.orgId],
      references: [organizations.id],
    }),
  })
);

export const glossaryEntriesRelations = relations(
  glossaryEntries,
  ({ one, many }) => ({
    org: one(organizations, {
      fields: [glossaryEntries.orgId],
      references: [organizations.id],
    }),
    translations: many(glossaryTranslations),
    submittedByUser: one(users, {
      fields: [glossaryEntries.submittedBy],
      references: [users.id],
    }),
  })
);

export const glossaryTranslationsRelations = relations(
  glossaryTranslations,
  ({ one }) => ({
    entry: one(glossaryEntries, {
      fields: [glossaryTranslations.entryId],
      references: [glossaryEntries.id],
    }),
  })
);

export const webhookConfigsRelations = relations(webhookConfigs, ({ one }) => ({
  org: one(organizations, {
    fields: [webhookConfigs.orgId],
    references: [organizations.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  project: one(projects, {
    fields: [activityLog.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  sourceFile: one(sourceFiles, {
    fields: [tasks.sourceFileId],
    references: [sourceFiles.id],
  }),
  assignedToUser: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: "task_assignee",
  }),
  createdByUser: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "task_creator",
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referrer",
  }),
  referee: one(users, {
    fields: [referrals.refereeId],
    references: [users.id],
    relationName: "referee",
  }),
}));

export const feedbackResponsesRelations = relations(feedbackResponses, ({ one }) => ({
  user: one(users, {
    fields: [feedbackResponses.userId],
    references: [users.id],
  }),
}));
