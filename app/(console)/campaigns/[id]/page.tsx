import { CampaignConsole } from "@/components/CampaignConsole";

export default async function CampaignConsolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CampaignConsole campaignId={id} />;
}
