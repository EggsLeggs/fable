import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  comments,
  commentMentions,
  translationKeys,
  orgMembers,
  users,
  type Db,
} from "@fable/db";
import { logActivity } from "../log-activity";

async function assertKeyAccess(db: Db, userId: string, keyId: string) {
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

function parseMentions(body: string): string[] {
  const matches = body.match(/@(\w+)/g) ?? [];
  return matches.map((m) => m.slice(1));
}

export const commentsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
        includeResolved: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertKeyAccess(ctx.db, ctx.session.user.id, input.keyId);

      const whereConditions = input.includeResolved
        ? eq(comments.keyId, input.keyId)
        : and(eq(comments.keyId, input.keyId), eq(comments.resolved, false));

      const allComments = await ctx.db.query.comments.findMany({
        where: whereConditions,
        with: {
          author: {
            columns: { id: true, name: true, username: true, image: true },
          },
          mentions: {
            with: {
              user: { columns: { id: true, name: true, username: true } },
            },
          },
        },
        orderBy: [desc(comments.createdAt)],
      });

      return allComments;
    }),

  create: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
        body: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { key, project } = await assertKeyAccess(ctx.db, ctx.session.user.id, input.keyId);

      const commentId = uuid();
      const now = new Date();

      const [comment] = await ctx.db
        .insert(comments)
        .values({
          id: commentId,
          keyId: input.keyId,
          authorId: ctx.session.user.id,
          body: input.body,
          resolved: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Parse @mentions and resolve to user IDs
      const mentionedUsernames = parseMentions(input.body);
      if (mentionedUsernames.length > 0) {
        const mentionedUsers = await ctx.db.query.users.findMany({
          where: (u, { inArray, isNotNull, and: a }) =>
            a(isNotNull(u.username), inArray(u.username, mentionedUsernames)),
          columns: { id: true },
        });

        if (mentionedUsers.length > 0) {
          await ctx.db.insert(commentMentions).values(
            mentionedUsers.map((u) => ({
              id: uuid(),
              commentId,
              userId: u.id,
            }))
          );
        }
      }

      await logActivity(ctx.db, {
        projectId: project.id,
        userId: ctx.session.user.id,
        type: "comment_added",
        metadata: {
          keyId: input.keyId,
          keyName: key.key,
          commentId,
          commentBody: input.body.slice(0, 120),
        },
      });

      return comment!;
    }),

  resolve: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.query.comments.findFirst({
        where: eq(comments.id, input.commentId),
        with: { key: { with: { project: true } } },
      });
      if (!comment) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, comment.key.project.orgId)
        ),
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      // Own comments: any role can resolve. Other comments: admin only.
      if (
        comment.authorId !== ctx.session.user.id &&
        !isAdminRole(member.role)
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db
        .update(comments)
        .set({ resolved: true, updatedAt: new Date() })
        .where(eq(comments.id, input.commentId));

      return { success: true };
    }),
});
