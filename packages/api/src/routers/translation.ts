import { z } from "zod";
import { eq, and, ne, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import {
  translations,
  translationKeys,
  translationVotes,
  projects,
  orgMembers,
  type Db,
} from "@fable/db";
import { logActivity } from "../log-activity";

async function getProjectMemberForKey(
  db: Db,
  userId: string,
  keyId: string
) {
  const key = await db.query.translationKeys.findFirst({
    where: eq(translationKeys.id, keyId),
    with: { project: true },
  });
  if (!key) throw new TRPCError({ code: "NOT_FOUND" });

  const member = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.userId, userId),
      eq(orgMembers.orgId, key.project.orgId)
    ),
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });

  return { key, project: key.project, member };
}

function isAdminRole(role: string) {
  return role === "owner" || role === "admin" || role === "member";
}

export const translationRouter = router({
  // --- New workflow-aware procedures ---

  save: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
        locale: z.string(),
        value: z.string(),
        pluralForms: z.record(z.string(), z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { key, project, member } = await getProjectMemberForKey(
        ctx.db,
        ctx.session.user.id,
        input.keyId
      );

      const isAdmin = isAdminRole(member.role);
      let resultingState: "suggested" | "approved";

      if (isAdmin && !project.adminSelfReviewRequired) {
        resultingState = "approved";
      } else if (!isAdmin && !project.translatorApprovalRequired) {
        resultingState = "approved";
      } else {
        resultingState = "suggested";
      }

      const now = new Date();
      let savedId: string;

      await ctx.db.transaction(async (tx) => {
        if (resultingState === "approved") {
          // Reject all existing suggestions for this key+locale
          await tx
            .update(translations)
            .set({ state: "rejected", updatedAt: now })
            .where(
              and(
                eq(translations.keyId, input.keyId),
                eq(translations.locale, input.locale),
                eq(translations.state, "suggested")
              )
            );

          // Find or create approved translation
          const existing = await tx.query.translations.findFirst({
            where: and(
              eq(translations.keyId, input.keyId),
              eq(translations.locale, input.locale),
              eq(translations.state, "approved")
            ),
          });

          if (existing) {
            await tx
              .update(translations)
              .set({
                value: input.value,
                pluralForms: input.pluralForms ?? null,
                translatedBy: ctx.session.user.id,
                approvedBy: ctx.session.user.id,
                approvedAt: now,
                updatedAt: now,
              })
              .where(eq(translations.id, existing.id));
            savedId = existing.id;
          } else {
            savedId = uuid();
            await tx.insert(translations).values({
              id: savedId,
              keyId: input.keyId,
              locale: input.locale,
              value: input.value,
              pluralForms: input.pluralForms ?? null,
              state: "approved",
              translatedBy: ctx.session.user.id,
              approvedBy: ctx.session.user.id,
              approvedAt: now,
            });
          }
        } else {
          // Save as suggested — upsert author's existing suggestion if present
          const existingSuggestion = await tx.query.translations.findFirst({
            where: and(
              eq(translations.keyId, input.keyId),
              eq(translations.locale, input.locale),
              eq(translations.translatedBy, ctx.session.user.id),
              eq(translations.state, "suggested")
            ),
          });

          if (existingSuggestion) {
            await tx
              .update(translations)
              .set({
                value: input.value,
                pluralForms: input.pluralForms ?? null,
                updatedAt: now,
              })
              .where(eq(translations.id, existingSuggestion.id));
            savedId = existingSuggestion.id;
          } else {
            savedId = uuid();
            await tx.insert(translations).values({
              id: savedId,
              keyId: input.keyId,
              locale: input.locale,
              value: input.value,
              pluralForms: input.pluralForms ?? null,
              state: "suggested",
              translatedBy: ctx.session.user.id,
            });
          }
        }
      });

      await logActivity(ctx.db, {
        projectId: project.id,
        userId: ctx.session.user.id,
        type: resultingState === "approved" ? "translation_approved" : "translation_suggested",
        locale: input.locale,
        metadata: {
          keyId: input.keyId,
          keyName: key.key,
          translationId: savedId!,
          translationValue: input.value.slice(0, 120),
        },
      });

      return { savedId: savedId!, resultingState };
    }),

  approve: protectedProcedure
    .input(z.object({ translationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const translation = await ctx.db.query.translations.findFirst({
        where: eq(translations.id, input.translationId),
        with: { key: { with: { project: true } } },
      });
      if (!translation) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, translation.key.project.orgId)
        ),
      });
      if (!member || !isAdminRole(member.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const project = translation.key.project;
      if (
        project.adminSelfReviewRequired &&
        translation.translatedBy === ctx.session.user.id &&
        member.role !== "owner"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot approve your own translation on this project",
        });
      }

      const now = new Date();

      await ctx.db.transaction(async (tx) => {
        // Reject all other suggestions for this key+locale
        await tx
          .update(translations)
          .set({ state: "rejected", updatedAt: now })
          .where(
            and(
              eq(translations.keyId, translation.keyId),
              eq(translations.locale, translation.locale),
              ne(translations.id, input.translationId),
              eq(translations.state, "suggested")
            )
          );

        // Also reject the current approved translation if different
        await tx
          .update(translations)
          .set({ state: "rejected", updatedAt: now })
          .where(
            and(
              eq(translations.keyId, translation.keyId),
              eq(translations.locale, translation.locale),
              ne(translations.id, input.translationId),
              eq(translations.state, "approved")
            )
          );

        // Approve this one
        await tx
          .update(translations)
          .set({
            state: "approved",
            approvedBy: ctx.session.user.id,
            approvedAt: now,
            updatedAt: now,
          })
          .where(eq(translations.id, input.translationId));
      });

      await logActivity(ctx.db, {
        projectId: project.id,
        userId: ctx.session.user.id,
        type: "translation_approved",
        locale: translation.locale,
        metadata: {
          keyId: translation.keyId,
          keyName: translation.key.key,
          translationId: input.translationId,
          translationValue: translation.value?.slice(0, 120) ?? undefined,
        },
      });

      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ translationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const translation = await ctx.db.query.translations.findFirst({
        where: eq(translations.id, input.translationId),
        with: { key: { with: { project: true } } },
      });
      if (!translation) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, translation.key.project.orgId)
        ),
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      const isAdmin = isAdminRole(member.role);
      // Translators can only reject their own suggestions
      if (!isAdmin && translation.translatedBy !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db
        .update(translations)
        .set({ state: "rejected", updatedAt: new Date() })
        .where(eq(translations.id, input.translationId));

      await logActivity(ctx.db, {
        projectId: translation.key.project.id,
        userId: ctx.session.user.id,
        type: "translation_rejected",
        locale: translation.locale,
        metadata: {
          keyId: translation.keyId,
          keyName: translation.key.key,
          translationId: input.translationId,
          translationValue: translation.value?.slice(0, 120) ?? undefined,
        },
      });

      return { success: true };
    }),

  get: protectedProcedure
    .input(z.object({ keyId: z.string(), locale: z.string() }))
    .query(async ({ ctx, input }) => {
      const { key, project, member } = await getProjectMemberForKey(
        ctx.db,
        ctx.session.user.id,
        input.keyId
      );

      const isAdmin = isAdminRole(member.role);

      const allTranslations = await ctx.db.query.translations.findMany({
        where: and(
          eq(translations.keyId, input.keyId),
          eq(translations.locale, input.locale)
        ),
        with: {
          translatedByUser: { columns: { id: true, name: true, username: true, image: true } },
          votes: true,
        },
      });

      const approved = allTranslations.find((t) => t.state === "approved") ?? null;
      const suggestions = allTranslations.filter((t) => t.state === "suggested");

      const userVoteMap = new Map(
        allTranslations
          .flatMap((t) => t.votes)
          .filter((v) => v.userId === ctx.session.user.id)
          .map((v) => [v.translationId, v.vote])
      );

      const suggestionsWithMeta = suggestions.map((s) => {
        const upvotes = s.votes.filter((v) => v.vote === "up").length;
        const downvotes = s.votes.filter((v) => v.vote === "down").length;
        const canApprove =
          isAdmin &&
          (member.role === "owner" ||
            !(project.adminSelfReviewRequired && s.translatedBy === ctx.session.user.id));
        return {
          ...s,
          upvotes,
          downvotes,
          userVote: (userVoteMap.get(s.id) ?? null) as "up" | "down" | null,
          canApprove,
          isOwn: s.translatedBy === ctx.session.user.id,
        };
      });

      return {
        approved,
        suggestions: suggestionsWithMeta,
        workflowSettings: {
          translatorApprovalRequired: project.translatorApprovalRequired,
          adminSelfReviewRequired: project.adminSelfReviewRequired,
        },
        userRole: member.role,
      };
    }),

  vote: protectedProcedure
    .input(
      z.object({
        translationId: z.string(),
        vote: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const translation = await ctx.db.query.translations.findFirst({
        where: eq(translations.id, input.translationId),
        with: { key: { with: { project: true } } },
      });
      if (!translation) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, translation.key.project.orgId)
        ),
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      const existing = await ctx.db.query.translationVotes.findFirst({
        where: and(
          eq(translationVotes.translationId, input.translationId),
          eq(translationVotes.userId, ctx.session.user.id)
        ),
      });

      if (existing) {
        if (existing.vote === input.vote) {
          // Toggle off — remove vote
          await ctx.db
            .delete(translationVotes)
            .where(eq(translationVotes.id, existing.id));
        } else {
          // Change vote
          await ctx.db
            .update(translationVotes)
            .set({ vote: input.vote })
            .where(eq(translationVotes.id, existing.id));
        }
      } else {
        await ctx.db.insert(translationVotes).values({
          id: uuid(),
          translationId: input.translationId,
          userId: ctx.session.user.id,
          vote: input.vote,
        });
      }

      return { success: true };
    }),

  // --- Legacy procedures kept for worker/API compatibility ---

  listKeys: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.translationKeys.findMany({
        where: eq(translationKeys.projectId, input.projectId),
        with: { translations: true },
        orderBy: (k, { asc }) => [asc(k.key)],
      });
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
        locale: z.string(),
        value: z.string(),
        state: z
          .enum(["suggested", "needs_review", "approved", "rejected"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.translations.findFirst({
        where: and(
          eq(translations.keyId, input.keyId),
          eq(translations.locale, input.locale),
          eq(translations.state, "approved")
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(translations)
          .set({
            value: input.value,
            state: input.state ?? "needs_review",
            translatedBy: ctx.session.user.id,
            updatedAt: new Date(),
          })
          .where(eq(translations.id, existing.id))
          .returning();
        return updated!;
      }

      const [created] = await ctx.db
        .insert(translations)
        .values({
          id: uuid(),
          keyId: input.keyId,
          locale: input.locale,
          value: input.value,
          state: input.state ?? "needs_review",
          translatedBy: ctx.session.user.id,
        })
        .returning();
      return created!;
    }),

  updateState: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        state: z.enum(["suggested", "needs_review", "approved", "rejected"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(translations)
        .set({
          state: input.state,
          reviewedBy: ctx.session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(translations.id, input.id))
        .returning();
      return updated!;
    }),

  suggest: publicProcedure
    .input(
      z.object({
        keyId: z.string(),
        locale: z.string(),
        value: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const key = await ctx.db.query.translationKeys.findFirst({
        where: eq(translationKeys.id, input.keyId),
        with: { project: true },
      });

      if (!key?.project.allowContributions) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This project does not accept community contributions",
        });
      }

      const [created] = await ctx.db
        .insert(translations)
        .values({
          id: uuid(),
          keyId: input.keyId,
          locale: input.locale,
          value: input.value,
          state: "suggested",
        })
        .returning();
      return created!;
    }),
});
