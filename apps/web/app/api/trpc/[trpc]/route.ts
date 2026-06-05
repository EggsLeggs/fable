import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@fable/api";
import { getIngestQueue, getPushTranslationsQueue } from "@/lib/queues";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createTRPCContext(req, getIngestQueue(), getPushTranslationsQueue()),
  });

export { handler as GET, handler as POST };
