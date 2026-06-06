import { randomUUID } from "node:crypto";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@fable/auth";
import type { Session } from "@fable/auth";
import { db } from "@fable/db";
import { createLogger } from "@fable/logger";

const log = createLogger("api");

const TRPC_STATUS_MAP: Partial<Record<TRPCError["code"], number>> = {
  PARSE_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  TIMEOUT: 408,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

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
    requestId: req.headers.get("x-request-id") ?? randomUUID(),
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

const loggingMiddleware = t.middleware(async ({ path, type, ctx, next }) => {
  const startedAt = Date.now();
  const result = await next();
  const durationMs = Date.now() - startedAt;
  const meta = {
    requestId: ctx.requestId,
    procedure: path,
    type,
    transport: "trpc",
    durationMs,
    userId: ctx.session?.user.id,
  };

  if (result.ok) {
    log.debug({ ...meta, status: 200 }, "tRPC OK");
    return result;
  }

  const status = TRPC_STATUS_MAP[result.error.code] ?? 500;
  const errorMeta = {
    ...meta,
    status,
    errorCode: result.error.code,
    err: result.error,
  };

  if (status >= 500) {
    log.error(errorMeta, "tRPC error");
  } else {
    log.warn(errorMeta, "tRPC error");
  }

  return result;
});

export const publicProcedure = t.procedure.use(loggingMiddleware);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session as Session },
  });
});
