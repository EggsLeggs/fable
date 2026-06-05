import { router } from "./trpc";
import { organizationRouter } from "./routers/organization";
import { projectRouter } from "./routers/project";
import { translationRouter } from "./routers/translation";
import { userRouter } from "./routers/user";

export const appRouter = router({
  organization: organizationRouter,
  project: projectRouter,
  translation: translationRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
