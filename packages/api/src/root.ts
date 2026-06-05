import { router } from "./trpc";
import { activityRouter } from "./routers/activity";
import { billingRouter } from "./routers/billing";
import { commentsRouter } from "./routers/comments";
import { organizationRouter } from "./routers/organization";
import { projectRouter } from "./routers/project";
import { referralRouter } from "./routers/referral";
import { sourceFileRouter } from "./routers/source-file";
import { stringsRouter } from "./routers/strings";
import { taskRouter } from "./routers/task";
import { tmRouter } from "./routers/tm";
import { translationRouter } from "./routers/translation";
import { userRouter } from "./routers/user";

export const appRouter = router({
  activity: activityRouter,
  billing: billingRouter,
  comments: commentsRouter,
  organization: organizationRouter,
  project: projectRouter,
  referral: referralRouter,
  sourceFile: sourceFileRouter,
  strings: stringsRouter,
  task: taskRouter,
  tm: tmRouter,
  translation: translationRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
