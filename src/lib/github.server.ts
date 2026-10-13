import { parseRepository } from "./machine-core";
// Edge runtimes (Cloudflare Workers) reject redirect:"error"; use "manual" and refuse any 3xx.
export async function githubFetch(
  path: string,
  raw = false,
  fetcher: typeof fetch = fetch,
  token?: string,
) {
  const response = await fetcher("https://api.github.com" + path, {
    headers: {
      Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "User-Agent": "devlab-machines",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  if ((response.status >= 300 && response.status < 400) || response.type === "opaqueredirect") {
    await response.body?.cancel();
    throw new Error(`GitHub ${response.status}: unexpected redirect refused (repository may have moved or been renamed; use its current URL)`);
  }
  return readGithub(response);
}
async function github(path: string, raw = false) {
  return githubFetch(path, raw, fetch, process.env["GITHUB_TOKEN"] || undefined);
}
async function readGithub(response: Response) {
  if (!response.ok)
    throw new Error(
      `GitHub ${response.status}: ${response.status === 404 ? "Public repository or file not found" : response.status === 403 ? "Repository lookup rate limited. Retry later or configure an operator GITHUB_TOKEN for higher lookup limits." : "Repository lookup unavailable"}`,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error("GitHub returned no body");
  let result = "",
    size = 0;
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 250000) {
      await reader.cancel();
      throw new Error("GitHub response exceeds 250 KB");
    }
    result += dec.decode(value, { stream: true });
  }
  return result;
}
export async function repositorySnapshot(url: string) {
  const { owner, repo, url: canonicalUrl } = parseRepository(url);
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const meta = JSON.parse(await github(base)) as {
    private: boolean;
    archived: boolean;
    default_branch: string;
    description: string;
    stargazers_count: number;
    language: string;
    license: { spdx_id: string } | null;
  };
  if (meta.private || meta.archived) throw new Error("Repository must be public and not archived");
  const commits = JSON.parse(
    await github(base + "/commits?sha=" + encodeURIComponent(meta.default_branch) + "&per_page=1"),
  ) as { sha: string }[];
  const commit = commits[0];
  if (!commit) throw new Error("Repository has no commit");
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error("GitHub did not provide a pinned commit");
  let readme = "";
  try {
    readme = (await github(base + "/readme?ref=" + commit.sha, true)).slice(0, 20000);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("404")) throw e;
  }
  return {
    owner,
    repo,
    url: canonicalUrl,
    branch: meta.default_branch,
    commit: commit.sha,
    description: meta.description ?? "",
    stars: meta.stargazers_count,
    language: meta.language ?? "",
    license: meta.license?.spdx_id ?? "NOASSERTION",
    readme,
  };
}
export async function pinnedFile(url: string, commit: string, path: string) {
  const { owner, repo } = parseRepository(url);
  if (
    !/^[a-f0-9]{40}$/.test(commit) ||
    path.startsWith("/") ||
    path.split("/").some((p) => p === ".." || p === ".git")
  )
    throw new Error("Unsafe pinned file");
  return github(
    `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${commit}`,
    true,
  );
}
