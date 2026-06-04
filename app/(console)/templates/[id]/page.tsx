import { TemplateConsole } from "@/components/TemplateConsole";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TemplateConsole templateId={id} />;
}
