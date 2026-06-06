import type { VcsProvider } from "./index";

export async function getInstallationToken(
  installationId: string
): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) {
    throw new Error(
      "GITHUB_APP_ID and GITHUB_PRIVATE_KEY must be set for VCS ingestion"
    );
  }

  const jwt = await import("jsonwebtoken");
  const appToken = jwt.default.sign({ iss: appId }, privateKey, {
    algorithm: "RS256",
    expiresIn: "10m",
  });

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get installation token: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

export async function fetchGitHubFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch file from GitHub: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { content: string; encoding: string };
  if (data.encoding !== "base64") {
    throw new Error(`Unexpected encoding: ${data.encoding}`);
  }
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export function createGitHubProvider(opts: {
  installationId: string;
  repoOwner: string;
  repoName: string;
}): VcsProvider {
  let tokenPromise: Promise<string> | null = null;

  async function getToken(): Promise<string> {
    tokenPromise ??= getInstallationToken(opts.installationId);
    return tokenPromise;
  }

  return {
    async fetchFile(path, ref) {
      return fetchGitHubFileContent(
        await getToken(),
        opts.repoOwner,
        opts.repoName,
        path,
        ref
      );
    },
  };
}
