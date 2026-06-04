import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { translations, translationKeys } from "@fable/db";

export const translationRouter = router({
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
          eq(translations.locale, input.locale)
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
