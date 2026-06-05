import { auth } from "@/lib/auth";
import { LandingPage } from "@/components/LandingPage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  return <LandingPage isLoggedIn={!!session?.user?.id} />;
}
