import "server-only";

const API = "https://api.github.com";

async function gh<T>(token: string, path: string, accept = "application/vnd.github+json"): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cadence",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${path} failed: ${res.status}`);
  return (accept.includes("raw") ? res.text() : res.json()) as Promise<T>;
}

export type Repo = {
  fullName: string;
  description: string | null;
  private: boolean;
  pushedAt: string;
  stars: number;
  language: string | null;
};

export async function listRepos(token: string): Promise<Repo[]> {
  const data = await gh<
    {
      full_name: string;
      description: string | null;
      private: boolean;
      pushed_at: string;
      stargazers_count: number;
      language: string | null;
      fork: boolean;
    }[]
  >(token, "/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator");
  return data
    .filter((r) => !r.fork)
    .map((r) => ({
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      pushedAt: r.pushed_at,
      stars: r.stargazers_count,
      language: r.language,
    }));
}

export type RepoContext = {
  fullName: string;
  url: string;
  description: string | null;
  homepage: string | null;
  topics: string[];
  language: string | null;
  stars: number;
  latestRelease: { tag: string; name: string | null; body: string | null } | null;
  commits: { message: string; date: string }[];
  readme: string | null;
};

export async function getRepoContext(token: string, fullName: string): Promise<RepoContext> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) throw new Error("Invalid repository name");

  const [repo, commits, readme, release] = await Promise.all([
    gh<{
      html_url: string;
      description: string | null;
      homepage: string | null;
      topics?: string[];
      language: string | null;
      stargazers_count: number;
    }>(token, `/repos/${fullName}`),
    gh<{ commit: { message: string; author: { date: string } | null } }[]>(
      token,
      `/repos/${fullName}/commits?per_page=15`,
    ).catch(() => []),
    gh<string>(token, `/repos/${fullName}/readme`, "application/vnd.github.raw+json").catch(() => null),
    gh<{ tag_name: string; name: string | null; body: string | null }>(
      token,
      `/repos/${fullName}/releases/latest`,
    ).catch(() => null),
  ]);

  return {
    fullName,
    url: repo.html_url,
    description: repo.description,
    homepage: repo.homepage || null,
    topics: repo.topics ?? [],
    language: repo.language,
    stars: repo.stargazers_count,
    latestRelease: release ? { tag: release.tag_name, name: release.name, body: release.body } : null,
    commits: commits.map((c) => ({
      message: c.commit.message.split("\n")[0],
      date: c.commit.author?.date ?? "",
    })),
    readme,
  };
}
