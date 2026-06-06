import { relations } from "drizzle-orm/relations";
import { glossaryEntry, glossaryTranslation, organization, orgMember, user, project, translationKey, sourceFile, projectLocale, session, account, translation, translationMemory, webhookConfig, comment, githubInstallation, ingestJob, pushJob, vcsIntegration, referral, activityLog, translationVote, task, commentMention } from "./schema";

export const glossaryTranslationRelations = relations(glossaryTranslation, ({one}) => ({
	glossaryEntry: one(glossaryEntry, {
		fields: [glossaryTranslation.entryId],
		references: [glossaryEntry.id]
	}),
}));

export const glossaryEntryRelations = relations(glossaryEntry, ({one, many}) => ({
	glossaryTranslations: many(glossaryTranslation),
	organization: one(organization, {
		fields: [glossaryEntry.orgId],
		references: [organization.id]
	}),
}));

export const orgMemberRelations = relations(orgMember, ({one}) => ({
	organization: one(organization, {
		fields: [orgMember.orgId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [orgMember.userId],
		references: [user.id]
	}),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	orgMembers: many(orgMember),
	projects: many(project),
	translationMemories: many(translationMemory),
	glossaryEntries: many(glossaryEntry),
	webhookConfigs: many(webhookConfig),
}));

export const userRelations = relations(user, ({one, many}) => ({
	orgMembers: many(orgMember),
	sessions: many(session),
	accounts: many(account),
	translations_translatedBy: many(translation, {
		relationName: "translation_translatedBy_user_id"
	}),
	translations_reviewedBy: many(translation, {
		relationName: "translation_reviewedBy_user_id"
	}),
	translations_approvedBy: many(translation, {
		relationName: "translation_approvedBy_user_id"
	}),
	user: one(user, {
		fields: [user.referredBy],
		references: [user.id],
		relationName: "user_referredBy_user_id"
	}),
	users: many(user, {
		relationName: "user_referredBy_user_id"
	}),
	comments: many(comment),
	githubInstallations: many(githubInstallation),
	referrals_referrerId: many(referral, {
		relationName: "referral_referrerId_user_id"
	}),
	referrals_refereeId: many(referral, {
		relationName: "referral_refereeId_user_id"
	}),
	activityLogs: many(activityLog),
	translationVotes: many(translationVote),
	tasks_assignedTo: many(task, {
		relationName: "task_assignedTo_user_id"
	}),
	tasks_createdBy: many(task, {
		relationName: "task_createdBy_user_id"
	}),
	commentMentions: many(commentMention),
}));

export const translationKeyRelations = relations(translationKey, ({one, many}) => ({
	project: one(project, {
		fields: [translationKey.projectId],
		references: [project.id]
	}),
	sourceFile: one(sourceFile, {
		fields: [translationKey.sourceFileId],
		references: [sourceFile.id]
	}),
	translations: many(translation),
	comments: many(comment),
}));

export const projectRelations = relations(project, ({one, many}) => ({
	translationKeys: many(translationKey),
	projectLocales: many(projectLocale),
	organization: one(organization, {
		fields: [project.orgId],
		references: [organization.id]
	}),
	pushJobs: many(pushJob),
	activityLogs: many(activityLog),
	tasks: many(task),
	sourceFiles: many(sourceFile),
	vcsIntegrations: many(vcsIntegration),
}));

export const sourceFileRelations = relations(sourceFile, ({one, many}) => ({
	translationKeys: many(translationKey),
	ingestJobs: many(ingestJob),
	tasks: many(task),
	project: one(project, {
		fields: [sourceFile.projectId],
		references: [project.id]
	}),
	vcsIntegration: one(vcsIntegration, {
		fields: [sourceFile.vcsIntegrationId],
		references: [vcsIntegration.id]
	}),
}));

export const projectLocaleRelations = relations(projectLocale, ({one}) => ({
	project: one(project, {
		fields: [projectLocale.projectId],
		references: [project.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const translationRelations = relations(translation, ({one, many}) => ({
	translationKey: one(translationKey, {
		fields: [translation.keyId],
		references: [translationKey.id]
	}),
	user_translatedBy: one(user, {
		fields: [translation.translatedBy],
		references: [user.id],
		relationName: "translation_translatedBy_user_id"
	}),
	user_reviewedBy: one(user, {
		fields: [translation.reviewedBy],
		references: [user.id],
		relationName: "translation_reviewedBy_user_id"
	}),
	user_approvedBy: one(user, {
		fields: [translation.approvedBy],
		references: [user.id],
		relationName: "translation_approvedBy_user_id"
	}),
	translationVotes: many(translationVote),
}));

export const translationMemoryRelations = relations(translationMemory, ({one}) => ({
	organization: one(organization, {
		fields: [translationMemory.orgId],
		references: [organization.id]
	}),
}));

export const webhookConfigRelations = relations(webhookConfig, ({one}) => ({
	organization: one(organization, {
		fields: [webhookConfig.orgId],
		references: [organization.id]
	}),
}));

export const commentRelations = relations(comment, ({one, many}) => ({
	translationKey: one(translationKey, {
		fields: [comment.keyId],
		references: [translationKey.id]
	}),
	user: one(user, {
		fields: [comment.authorId],
		references: [user.id]
	}),
	commentMentions: many(commentMention),
}));

export const githubInstallationRelations = relations(githubInstallation, ({one}) => ({
	user: one(user, {
		fields: [githubInstallation.userId],
		references: [user.id]
	}),
}));

export const ingestJobRelations = relations(ingestJob, ({one}) => ({
	sourceFile: one(sourceFile, {
		fields: [ingestJob.sourceFileId],
		references: [sourceFile.id]
	}),
}));

export const pushJobRelations = relations(pushJob, ({one}) => ({
	project: one(project, {
		fields: [pushJob.projectId],
		references: [project.id]
	}),
	vcsIntegration: one(vcsIntegration, {
		fields: [pushJob.vcsIntegrationId],
		references: [vcsIntegration.id]
	}),
}));

export const vcsIntegrationRelations = relations(vcsIntegration, ({one, many}) => ({
	pushJobs: many(pushJob),
	sourceFiles: many(sourceFile),
	project: one(project, {
		fields: [vcsIntegration.projectId],
		references: [project.id]
	}),
}));

export const referralRelations = relations(referral, ({one}) => ({
	user_referrerId: one(user, {
		fields: [referral.referrerId],
		references: [user.id],
		relationName: "referral_referrerId_user_id"
	}),
	user_refereeId: one(user, {
		fields: [referral.refereeId],
		references: [user.id],
		relationName: "referral_refereeId_user_id"
	}),
}));

export const activityLogRelations = relations(activityLog, ({one}) => ({
	project: one(project, {
		fields: [activityLog.projectId],
		references: [project.id]
	}),
	user: one(user, {
		fields: [activityLog.userId],
		references: [user.id]
	}),
}));

export const translationVoteRelations = relations(translationVote, ({one}) => ({
	translation: one(translation, {
		fields: [translationVote.translationId],
		references: [translation.id]
	}),
	user: one(user, {
		fields: [translationVote.userId],
		references: [user.id]
	}),
}));

export const taskRelations = relations(task, ({one}) => ({
	project: one(project, {
		fields: [task.projectId],
		references: [project.id]
	}),
	sourceFile: one(sourceFile, {
		fields: [task.sourceFileId],
		references: [sourceFile.id]
	}),
	user_assignedTo: one(user, {
		fields: [task.assignedTo],
		references: [user.id],
		relationName: "task_assignedTo_user_id"
	}),
	user_createdBy: one(user, {
		fields: [task.createdBy],
		references: [user.id],
		relationName: "task_createdBy_user_id"
	}),
}));

export const commentMentionRelations = relations(commentMention, ({one}) => ({
	comment: one(comment, {
		fields: [commentMention.commentId],
		references: [comment.id]
	}),
	user: one(user, {
		fields: [commentMention.userId],
		references: [user.id]
	}),
}));