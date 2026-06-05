type Props = { params: Promise<{ projectId: string }> };

export default async function TranslationsPage({ params }: Props) {
  await params;
  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Translations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and edit translation keys across all locales.
        </p>
      </header>
    </div>
  );
}
