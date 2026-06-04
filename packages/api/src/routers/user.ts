import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { users, type SpokenLanguageLevel } from "@fable/db";

const spokenLanguageLevelSchema = z.enum([
  "elementary",
  "limited_working",
  "professional_working",
  "full_professional",
  "native",
]) satisfies z.ZodType<SpokenLanguageLevel>;

const spokenLanguageSchema = z.object({
  language: z.string().min(2).max(10),
  level: spokenLanguageLevelSchema,
});

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-z0-9_]+$/,
    "Username can only contain lowercase letters, numbers, and underscores"
  );

export const userRouter = router({
  checkUsernameAvailable: publicProcedure
    .input(z.object({ username: usernameSchema }))
    .query(async ({ ctx, input }) => {
      const taken = await ctx.db.query.users.findFirst({
        where: eq(users.username, input.username),
      });
      return { available: !taken };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        image: z.string().url().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, ctx.session.user.id))
        .returning();
      return updated!;
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        username: usernameSchema.optional().nullable(),
        timezone: z.string().min(1).max(100).optional(),
        timeFormat: z.enum(["12h", "24h"]).optional(),
        siteLocale: z.string().min(2).max(10).optional(),
        spokenLanguages: z.array(spokenLanguageSchema).max(20).optional(),
        profileVisibility: z.enum(["public", "private"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.username) {
        const taken = await ctx.db.query.users.findFirst({
          where: and(
            eq(users.username, input.username),
            ne(users.id, ctx.session.user.id)
          ),
        });
        if (taken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This username is already taken.",
          });
        }
      }

      const [updated] = await ctx.db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, ctx.session.user.id))
        .returning();

      return updated!;
    }),
});
