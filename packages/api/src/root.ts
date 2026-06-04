import { router } from "./trpc";
import { billingRouter } from "./routers/billing";
import { organizationRouter } from "./routers/organization";
import { projectRouter } from "./routers/project";
import { translationRouter } from "./routers/translation";
import { userRouter } from "./routers/user";

export const appRouter = router({
  billing: billingRouter,
  organization: organizationRouter,
  project: projectRouter,
  translation: translationRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
