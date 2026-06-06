import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@fable/api";
import { createLogger } from "@fable/logger";
import { getIngestQueue, getPushTranslationsQueue } from "@/lib/queues";

const log = createLogger("trpc");

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createTRPCContext(req, getIngestQueue(), getPushTranslationsQueue()),
    onError({ path, type, error }) {
      if (error.code !== "INTERNAL_SERVER_ERROR") return;

      log.error(
        {
          procedure: path,
          type,
          errorCode: error.code,
          err: error,
        },
        "tRPC handler error"
      );
    },
  });

export { handler as GET, handler as POST };
