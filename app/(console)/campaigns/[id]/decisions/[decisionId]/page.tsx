import { DecisionDetailView } from "@/components/DecisionDetailView";

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string; decisionId: string }>;
}) {
  const { id, decisionId } = await params;
  return <DecisionDetailView campaignId={id} decisionId={decisionId} />;
}
