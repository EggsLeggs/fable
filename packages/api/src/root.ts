import { router } from "./trpc";
import { billingRouter } from "./routers/billing";
import { organizationRouter } from "./routers/organization";
import { projectRouter } from "./routers/project";
import { sourceFileRouter } from "./routers/source-file";
import { taskRouter } from "./routers/task";
import { translationRouter } from "./routers/translation";
import { userRouter } from "./routers/user";

export const appRouter = router({
  billing: billingRouter,
  organization: organizationRouter,
  project: projectRouter,
  sourceFile: sourceFileRouter,
  task: taskRouter,
  translation: translationRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
