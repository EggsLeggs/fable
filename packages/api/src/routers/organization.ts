import { z } from "zod";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { router, protectedProcedure } from "../trpc";
import { organizations, orgMembers } from "@fable/db";

export const organizationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.orgMembers.findMany({
      where: eq(orgMembers.userId, ctx.session.user.id),
      with: { org: true },
    });
    return memberships.map((m) => ({ ...m.org, role: m.role }));
  }),

  get: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.slug, input.slug),
        with: { members: { with: { user: true } } },
      });
      if (!org) throw new Error("Organisation not found");
      return org;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(64),
        slug: z
          .string()
          .min(1)
          .max(48)
          .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = uuid();

      const [org] = await ctx.db
        .insert(organizations)
        .values({ id: orgId, name: input.name, slug: input.slug })
        .returning();

      await ctx.db.insert(orgMembers).values({
        id: uuid(),
        orgId,
        userId: ctx.session.user.id,
        role: "owner",
      });

      return org!;
    }),

  getOrCreate: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.query.orgMembers.findFirst({
      where: eq(orgMembers.userId, ctx.session.user.id),
      with: { org: true },
    });

    if (existing) return existing.org;

    const name = ctx.session.user.name ?? ctx.session.user.email?.split("@")[0] ?? "My Workspace";
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);

    const orgId = uuid();
    const [org] = await ctx.db
      .insert(organizations)
      .values({ id: orgId, name, slug: `${slug}-${orgId.slice(0, 6)}` })
      .returning();

    await ctx.db.insert(orgMembers).values({
      id: uuid(),
      orgId,
      userId: ctx.session.user.id,
      role: "owner",
    });

    return org!;
  }),
});
