import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@fable/auth";
import type { Session } from "@fable/auth";
import { db } from "@fable/db";

export type IngestQueue = {
  add: (name: string, data: unknown, opts?: { jobId?: string }) => Promise<unknown>;
};

export type PushTranslationsQueue = {
  add: (name: string, data: unknown, opts?: { jobId?: string }) => Promise<unknown>;
};

export async function createTRPCContext(
  req: Request,
  ingestQueue?: IngestQueue,
  pushTranslationsQueue?: PushTranslationsQueue
) {
  const session = await auth.api.getSession({ headers: req.headers });
  return {
    db,
    session,
    ingestQueue: ingestQueue ?? null,
    pushTranslationsQueue: pushTranslationsQueue ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof Error && "issues" in error.cause
            ? (error.cause as { issues: unknown }).issues
            : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session as Session },
  });
});
