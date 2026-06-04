import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@fable/auth";
import { db, orgMembers } from "@fable/db";
import { eq } from "drizzle-orm";
import { NewProjectWizard } from "@/components/NewProjectWizard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const memberships = await db.query.orgMembers.findMany({
    where: eq(orgMembers.userId, session.user.id),
    with: { org: { with: { projects: true } } },
  });

  const allProjects = memberships.flatMap((m) => m.org.projects);
  if (allProjects.length > 0 && allProjects[0]) {
    redirect(`/projects/${allProjects[0].id}`);
  }

  return (
    <div className="flex w-full flex-1 items-start justify-center pt-16 md:pt-24">
      <NewProjectWizard />
    </div>
  );
}
