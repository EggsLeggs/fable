import { z } from "zod";
import {
  eq,
  and,
  ilike,
  or,
  asc,
  count,
  sql,
  exists,
  notExists,
  inArray,
  type SQL,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  projects,
  orgMembers,
  translationKeys,
  translations,
  sourceFiles,
  comments,
  type Db,
} from "@fable/db";

async function assertProjectAccess(db: Db, userId: string, projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  const member = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, project.orgId)),
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
  return { project, member };
}

export const stringsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        locale: z.string(),
        fileId: z.string().optional(),
        q: z.string().optional(),
        label: z.string().optional(),
        filter: z
          .enum(["all", "untranslated", "needs_review", "approved", "has_comments"])
          .default("all"),
        status: z.enum(["active", "archived"]).default("active"),
        page: z.number().int().default(1),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const { project } = await assertProjectAccess(
        ctx.db,
        ctx.session.user.id,
        input.projectId
      );

      const limit = input.limit;
      const offset = (input.page - 1) * limit;

      const conditions: SQL[] = [
        eq(translationKeys.projectId, input.projectId),
        eq(translationKeys.status, input.status),
      ];

      if (input.fileId) {
        conditions.push(eq(translationKeys.sourceFileId, input.fileId));
      }

      if (input.label) {
        conditions.push(
          sql`${translationKeys.tags} @> ${JSON.stringify([input.label])}::jsonb`
        );
      }

      if (input.q) {
        const q = `%${input.q}%`;
        const searchCond = or(
          ilike(translationKeys.key, q),
          ilike(translationKeys.description, q)
        );
        if (searchCond) conditions.push(searchCond);
      }

      const locale = input.locale;

      if (input.filter === "untranslated") {
        conditions.push(
          notExists(
            ctx.db
              .select({ one: sql`1` })
              .from(translations)
              .where(
                and(
                  eq(translations.keyId, translationKeys.id),
                  eq(translations.locale, locale),
                  or(
                    eq(translations.state, "approved"),
                    eq(translations.state, "suggested"),
                    eq(translations.state, "needs_review")
                  )
                )
              )
          )
        );
      } else if (input.filter === "needs_review") {
        conditions.push(
          notExists(
            ctx.db
              .select({ one: sql`1` })
              .from(translations)
              .where(
                and(
                  eq(translations.keyId, translationKeys.id),
                  eq(translations.locale, locale),
                  eq(translations.state, "approved")
                )
              )
          ),
          exists(
            ctx.db
              .select({ one: sql`1` })
              .from(translations)
              .where(
                and(
                  eq(translations.keyId, translationKeys.id),
                  eq(translations.locale, locale),
                  or(
                    eq(translations.state, "suggested"),
                    eq(translations.state, "needs_review")
                  )
                )
              )
          )
        );
      } else if (input.filter === "approved") {
        conditions.push(
          exists(
            ctx.db
              .select({ one: sql`1` })
              .from(translations)
              .where(
                and(
                  eq(translations.keyId, translationKeys.id),
                  eq(translations.locale, locale),
                  eq(translations.state, "approved")
                )
              )
          )
        );
      } else if (input.filter === "has_comments") {
        conditions.push(
          exists(
            ctx.db
              .select({ one: sql`1` })
              .from(comments)
              .where(
                and(
                  eq(comments.keyId, translationKeys.id),
                  eq(comments.resolved, false)
                )
              )
          )
        );
      }

      const whereClause = and(...conditions);

      const rows = await ctx.db
        .select({
          id: translationKeys.id,
          key: translationKeys.key,
          context: translationKeys.description,
          labels: translationKeys.tags,
          screenshot: translationKeys.screenshot,
          status: translationKeys.status,
          sfId: sourceFiles.id,
          sfName: sourceFiles.name,
          sfFormat: sourceFiles.format,
          sourceValue: sql<string | null>`(
            SELECT t.value FROM "translation" t
            WHERE t."keyId" = ${translationKeys.id}
              AND t.locale = ${project.sourceLocale}
              AND t.state != 'rejected'
            ORDER BY t."updatedAt" DESC
            LIMIT 1
          )`,
        })
        .from(translationKeys)
        .leftJoin(sourceFiles, eq(sourceFiles.id, translationKeys.sourceFileId))
        .where(whereClause)
        .orderBy(asc(translationKeys.key))
        .limit(limit + 1)
        .offset(offset);

      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;

      const keyIds = pageRows.map((r) => r.id);

      // Get effective translations for this page of keys
      const effTranslations =
        keyIds.length > 0
          ? await ctx.db.query.translations.findMany({
              where: and(
                inArray(translations.keyId, keyIds),
                eq(translations.locale, locale),
                or(
                  eq(translations.state, "approved"),
                  eq(translations.state, "suggested"),
                  eq(translations.state, "needs_review")
                )
              ),
              orderBy: (t, { asc: a }) => [a(t.createdAt)],
            })
          : [];

      // Get comment counts
      const commentCounts =
        keyIds.length > 0
          ? await ctx.db
              .select({ keyId: comments.keyId, cnt: count() })
              .from(comments)
              .where(
                and(
                  inArray(comments.keyId, keyIds),
                  eq(comments.resolved, false)
                )
              )
              .groupBy(comments.keyId)
          : [];

      const commentCountMap = new Map(commentCounts.map((c) => [c.keyId, c.cnt]));

      const transMap = new Map<
        string,
        { id: string; value: string; state: string }
      >();
      for (const t of effTranslations) {
        const existing = transMap.get(t.keyId);
        // Prefer approved over suggested over needs_review
        if (!existing || t.state === "approved") {
          transMap.set(t.keyId, { id: t.id, value: t.value, state: t.state });
        }
      }

      let total: number | undefined;
      if (input.page === 1) {
        const [countResult] = await ctx.db
          .select({ total: count() })
          .from(translationKeys)
          .leftJoin(sourceFiles, eq(sourceFiles.id, translationKeys.sourceFileId))
          .where(whereClause);
        total = countResult?.total ?? 0;
      }

      return {
        strings: pageRows.map((r) => ({
          id: r.id,
          key: r.key,
          value: r.sourceValue ?? null,
          context: r.context ?? null,
          labels: r.labels ?? [],
          hasScreenshot: !!r.screenshot,
          hasComments: (commentCountMap.get(r.id) ?? 0) > 0,
          status: r.status,
          sourceFile: r.sfId
            ? { id: r.sfId, name: r.sfName!, format: r.sfFormat! }
            : null,
          translation: transMap.get(r.id) ?? null,
        })),
        total,
        hasMore,
        nextPage: hasMore ? input.page + 1 : null,
      };
    }),

  get: protectedProcedure
    .input(z.object({ keyId: z.string(), locale: z.string() }))
    .query(async ({ ctx, input }) => {
      const key = await ctx.db.query.translationKeys.findFirst({
        where: eq(translationKeys.id, input.keyId),
        with: {
          project: true,
          sourceFile: true,
        },
      });
      if (!key) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, key.project.orgId)
        ),
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      const sourceTranslation = await ctx.db.query.translations.findFirst({
        where: and(
          eq(translations.keyId, input.keyId),
          eq(translations.locale, key.project.sourceLocale),
          sql`${translations.state} != 'rejected'`
        ),
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
      });

      return {
        id: key.id,
        key: key.key,
        value: sourceTranslation?.value ?? null,
        context: key.description ?? null,
        labels: key.tags ?? [],
        maxLength: key.maxLength ?? null,
        isPlural: key.isPlural,
        pluralKey: key.pluralKey ?? null,
        hasScreenshot: !!key.screenshot,
        screenshot: key.screenshot ?? null,
        sourceFile: key.sourceFile
          ? {
              id: key.sourceFile.id,
              name: key.sourceFile.name,
              format: key.sourceFile.format,
            }
          : null,
        projectId: key.projectId,
        sourceLocale: key.project.sourceLocale,
      };
    }),

  nearby: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
        locale: z.string(),
        count: z.number().int().default(3),
      })
    )
    .query(async ({ ctx, input }) => {
      const key = await ctx.db.query.translationKeys.findFirst({
        where: eq(translationKeys.id, input.keyId),
        with: { project: true },
      });
      if (!key) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await ctx.db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.userId, ctx.session.user.id),
          eq(orgMembers.orgId, key.project.orgId)
        ),
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      const fileCondition = key.sourceFileId
        ? eq(translationKeys.sourceFileId, key.sourceFileId)
        : eq(translationKeys.projectId, key.projectId);

      const nearby = await ctx.db
        .select({ id: translationKeys.id, key: translationKeys.key })
        .from(translationKeys)
        .where(and(fileCondition, eq(translationKeys.status, "active")))
        .orderBy(asc(translationKeys.key))
        .limit(input.count * 4);

      const currentIdx = nearby.findIndex((k) => k.id === input.keyId);
      const start = Math.max(0, currentIdx - input.count);
      const end = Math.min(nearby.length - 1, currentIdx + input.count);
      const surrounding = nearby
        .slice(start, end + 1)
        .filter((k) => k.id !== input.keyId);

      if (surrounding.length === 0) return [];

      const nearbyIds = surrounding.map((k) => k.id);

      const [nearbyTranslations, nearbySourceValues] = await Promise.all([
        ctx.db.query.translations.findMany({
          where: and(
            inArray(translations.keyId, nearbyIds),
            eq(translations.locale, input.locale),
            eq(translations.state, "approved")
          ),
        }),
        ctx.db.query.translations.findMany({
          where: and(
            inArray(translations.keyId, nearbyIds),
            eq(translations.locale, key.project.sourceLocale),
            sql`${translations.state} != 'rejected'`
          ),
          orderBy: (t, { desc }) => [desc(t.updatedAt)],
        }),
      ]);

      const transMap = new Map(nearbyTranslations.map((t) => [t.keyId, t]));
      const sourceMap = new Map<string, string>();
      for (const t of nearbySourceValues) {
        if (!sourceMap.has(t.keyId)) sourceMap.set(t.keyId, t.value);
      }

      return surrounding.map((k) => ({
        id: k.id,
        key: k.key,
        sourceValue: sourceMap.get(k.id) ?? null,
        translatedValue: transMap.get(k.id)?.value ?? null,
      }));
    }),
});
