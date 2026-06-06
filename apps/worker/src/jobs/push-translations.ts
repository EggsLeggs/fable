import type { Job } from "bullmq";
import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import {
  db,
  pushJobs,
  vcsIntegrations,
  sourceFiles,
  translationKeys,
  translations,
  projects,
} from "@fable/db";
import { buildTranslationFiles } from "@fable/formats";
import { getInstallationToken } from "@fable/ingest/providers/github";

export interface PushTranslationsPayload {
  pushJobId: string;
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function getBranchSha(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    { headers: ghHeaders(token) }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get branch ${branch}: ${res.status}`);
  const data = (await res.json()) as { object: { sha: string } };
  return data.object.sha;
}

async function createOrUpdateBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string
): Promise<void> {
  const existing = await getBranchSha(token, owner, repo, branch);
  if (existing) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers: ghHeaders(token),
        body: JSON.stringify({ sha, force: true }),
      }
    );
    if (!res.ok) throw new Error(`Failed to update branch: ${res.status}`);
  } else {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: "POST",
        headers: ghHeaders(token),
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
      }
    );
    if (!res.ok) throw new Error(`Failed to create branch: ${res.status}`);
  }
}

async function createBlob(
  token: string,
  owner: string,
  repo: string,
  content: string
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
    {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({
        content: Buffer.from(content).toString("base64"),
        encoding: "base64",
      }),
    }
  );
  if (!res.ok) throw new Error(`Failed to create blob: ${res.status}`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function getTreeSha(
  token: string,
  owner: string,
  repo: string,
  commitSha: string
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`,
    { headers: ghHeaders(token) }
  );
  if (!res.ok) throw new Error(`Failed to get commit: ${res.status}`);
  const data = (await res.json()) as { tree: { sha: string } };
  return data.tree.sha;
}

async function createTree(
  token: string,
  owner: string,
  repo: string,
  baseTreeSha: string,
  files: Array<{ path: string; blobSha: string }>
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees`,
    {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: files.map((f) => ({
          path: f.path,
          mode: "100644",
          type: "blob",
          sha: f.blobSha,
        })),
      }),
    }
  );
  if (!res.ok) throw new Error(`Failed to create tree: ${res.status}`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function createCommit(
  token: string,
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
    }
  );
  if (!res.ok) throw new Error(`Failed to create commit: ${res.status}`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function findOrCreatePr(
  token: string,
  owner: string,
  repo: string,
  head: string,
  base: string
): Promise<string> {
  const listRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${head}&base=${base}&state=open`,
    { headers: ghHeaders(token) }
  );
  if (listRes.ok) {
    const prs = (await listRes.json()) as Array<{ html_url: string }>;
    if (prs.length > 0 && prs[0]) return prs[0].html_url;
  }

  const createRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({
        title: "chore: update translations via Fable",
        body: "This pull request was automatically created by [Fable](https://fable.so) with the latest approved translations.",
        head,
        base,
      }),
    }
  );
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create PR: ${createRes.status} ${text}`);
  }
  const pr = (await createRes.json()) as { html_url: string };
  return pr.html_url;
}

export async function handlePushTranslations(
  job: Job<PushTranslationsPayload>
): Promise<void> {
  const { pushJobId } = job.data;

  const pushJob = await db.query.pushJobs.findFirst({
    where: eq(pushJobs.id, pushJobId),
  });
  if (!pushJob) throw new Error(`PushJob ${pushJobId} not found`);

  await db
    .update(pushJobs)
    .set({ status: "processing", startedAt: new Date() })
    .where(eq(pushJobs.id, pushJobId));

  try {
    const integration = await db.query.vcsIntegrations.findFirst({
      where: eq(vcsIntegrations.id, pushJob.vcsIntegrationId),
    });
    if (!integration) throw new Error("VCS integration not found");

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, pushJob.projectId),
    });
    if (!project) throw new Error("Project not found");

    const vcsFiles = await db.query.sourceFiles.findMany({
      where: and(
        eq(sourceFiles.vcsIntegrationId, integration.id),
        eq(sourceFiles.status, "active"),
        eq(sourceFiles.pushEnabled, true)
      ),
    });

    if (vcsFiles.length === 0) {
      await db
        .update(pushJobs)
        .set({ status: "done", completedAt: new Date() })
        .where(eq(pushJobs.id, pushJobId));
      return;
    }

    const token = await getInstallationToken(integration.installationId);
    const { repoOwner: owner, repoName: repo } = integration;

    const filesToCommit: Array<{ path: string; content: string }> = [];

    for (const sourceFile of vcsFiles) {
      const keys = await db.query.translationKeys.findMany({
        where: and(
          eq(translationKeys.sourceFileId, sourceFile.id),
          eq(translationKeys.status, "active")
        ),
      });
      if (keys.length === 0) continue;
      const keyIds = keys.map((k) => k.id);
      if (pushJob.locales.length === 0) continue;

      const approvedTranslations = await db.query.translations.findMany({
        where: and(
          inArray(translations.keyId, keyIds),
          inArray(translations.locale, pushJob.locales),
          eq(translations.state, "approved")
        ),
      });
      if (approvedTranslations.length === 0) continue;

      const sourceTranslations =
        sourceFile.format === "lingui_json"
          ? await db.query.translations.findMany({
              where: and(
                inArray(translations.keyId, keyIds),
                eq(translations.locale, project.sourceLocale),
                eq(translations.state, "approved")
              ),
            })
          : [];

      const files = buildTranslationFiles({
        sourceFile,
        keys,
        approvedTranslations,
        sourceTranslations,
        sourceLocale: project.sourceLocale,
        targetLocales: pushJob.locales,
      });

      for (const file of files) {
        filesToCommit.push(file);
      }
    }

    if (filesToCommit.length === 0) {
      await db
        .update(pushJobs)
        .set({ status: "done", completedAt: new Date() })
        .where(eq(pushJobs.id, pushJobId));
      return;
    }

    // Get base branch SHA
    const baseSha = await getBranchSha(token, owner, repo, integration.defaultBranch);
    if (!baseSha) throw new Error(`Branch ${integration.defaultBranch} not found`);

    // Create blobs for each file
    const blobEntries: Array<{ path: string; blobSha: string }> = [];
    for (const file of filesToCommit) {
      const blobSha = await createBlob(token, owner, repo, file.content);
      blobEntries.push({ path: file.path, blobSha });
    }

    // Build tree and commit
    const baseTreeSha = await getTreeSha(token, owner, repo, baseSha);
    const newTreeSha = await createTree(token, owner, repo, baseTreeSha, blobEntries);
    const commitMessage = `chore: update translations via Fable\n\nLocales: ${pushJob.locales.join(", ")}`;
    const newCommitSha = await createCommit(token, owner, repo, commitMessage, newTreeSha, baseSha);

    // Push to translation branch
    await createOrUpdateBranch(token, owner, repo, integration.translationBranch, newCommitSha);

    // Open or find PR
    let prUrl: string | null = null;
    if (integration.pushMode === "pull_request") {
      prUrl = await findOrCreatePr(token, owner, repo, integration.translationBranch, integration.defaultBranch);
    }

    // Update lastPushedAt on all source files
    const now = new Date();
    for (const sourceFile of vcsFiles) {
      await db
        .update(sourceFiles)
        .set({ lastPushedAt: now, updatedAt: now })
        .where(eq(sourceFiles.id, sourceFile.id));
    }

    await db
      .update(pushJobs)
      .set({ status: "done", prUrl, completedAt: now })
      .where(eq(pushJobs.id, pushJobId));

    console.log(`[push-translations] job ${pushJobId} done, PR: ${prUrl ?? "direct push"}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[push-translations] job ${pushJobId} failed:`, message);
    await db
      .update(pushJobs)
      .set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(pushJobs.id, pushJobId));
    throw err;
  }
}
