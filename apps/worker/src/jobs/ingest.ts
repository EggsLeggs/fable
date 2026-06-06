import type { Job } from "bullmq";
import { ingestSourceFile } from "@fable/ingest";
import { createGitHubProvider } from "@fable/ingest/providers/github";

export interface IngestJobPayload {
  ingestJobId: string;
  sourceFileId: string;
}

export async function handleIngest(
  job: Job<IngestJobPayload>
): Promise<void> {
  await ingestSourceFile({
    ingestJobId: job.data.ingestJobId,
    sourceFileId: job.data.sourceFileId,
    createVcsProvider: (integration) => createGitHubProvider(integration),
  });
}
