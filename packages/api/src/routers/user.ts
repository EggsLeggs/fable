import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { users, githubInstallations, type SpokenLanguageLevel } from "@fable/db";

async function getInstallationToken(installationId: string): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "GitHub App is not configured",
    });
  }
  const jwt = await import("jsonwebtoken");
  const appToken = jwt.default.sign({ iss: appId }, privateKey, {
    algorithm: "RS256",
    expiresIn: "10m",
  });
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get GitHub installation token",
    });
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

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

  getGitHubInstallation: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.query.githubInstallations.findFirst({
      where: eq(githubInstallations.userId, ctx.session.user.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    return result ?? null;
  }),

  disconnectGitHub: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(githubInstallations)
      .where(eq(githubInstallations.userId, ctx.session.user.id));
    return { success: true };
  }),

  listGitHubRepos: protectedProcedure.query(async ({ ctx }) => {
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
