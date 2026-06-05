import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { users, githubInstallations, type SpokenLanguageLevel } from "@fable/db";
import {
  getIntegrationAvailability,
  getInstallationToken,
  isGitHubAppConfigured,
  isInstallationActive,
} from "../integration-config";

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

const handleSchema = z
  .string()
  .min(3, "Handle must be at least 3 characters")
  .max(30, "Handle must be at most 30 characters")
  .regex(
    /^[a-z0-9_]+$/,
    "Handle can only contain lowercase letters, numbers, and underscores"
  );

export const userRouter = router({
  getIntegrationAvailability: publicProcedure.query(() => getIntegrationAvailability()),

  checkUsernameAvailable: publicProcedure
    .input(z.object({ username: handleSchema }))
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
        username: handleSchema.optional().nullable(),
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
            message: "This handle is already taken.",
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

  getGitHubInstallation: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.query.githubInstallations.findFirst({
      where: eq(githubInstallations.userId, ctx.session.user.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    if (!result) return null;

    if (isGitHubAppConfigured()) {
      const active = await isInstallationActive(result.installationId);
      if (!active) {
        await ctx.db
          .delete(githubInstallations)
          .where(eq(githubInstallations.id, result.id));
        return null;
      }
    }

    return result;
  }),

  disconnectGitHub: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(githubInstallations)
      .where(eq(githubInstallations.userId, ctx.session.user.id));
    return { success: true };
  }),

  listGitHubRepos: protectedProcedure.query(async ({ ctx }) => {
    if (!isGitHubAppConfigured()) return [];

    const installation = await ctx.db.query.githubInstallations.findFirst({
      where: eq(githubInstallations.userId, ctx.session.user.id),
    });
    if (!installation) return [];

    const token = await getInstallationToken(installation.installationId);

    const res = await fetch(
      "https://api.github.com/installation/repositories?per_page=100",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      repositories: Array<{
        id: number;
        full_name: string;
        private: boolean;
        default_branch: string;
      }>;
    };

    return data.repositories.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      private: r.private,
      defaultBranch: r.default_branch,
    }));
  }),
});
