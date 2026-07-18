'use client';

import { useEffect, useState } from 'react';
import { GITHUB_API_REPO } from './assets';

export interface RepoLanguage {
  name: string;
  /** Share of the codebase, 0-100. */
  pct: number;
  color: string;
}

export interface RepoCommit {
  message: string;
  login: string;
  avatar: string | null;
  sha: string;
  when: string;
  url: string;
}

export interface RepoContributor {
  login: string;
  avatar: string;
  url: string;
}

export interface RepoFacts {
  forks: string;
  issues: string;
  watching: string;
  license: string;
  lastPush: string;
}

export interface RepoInsights {
  facts: RepoFacts | null;
  /** Compact fork count for the hero console, e.g. '128'. */
  forks: string | null;
  languages: RepoLanguage[] | null;
  commits: RepoCommit[] | null;
  contributors: RepoContributor[] | null;
  /** Weekly commit totals for the heartbeat sparkline (oldest first). */
  heartbeat: number[] | null;
}

const EMPTY: RepoInsights = {
  facts: null,
  forks: null,
  languages: null,
  commits: null,
  contributors: null,
  heartbeat: null,
};

const GITHUB_ACCEPT = 'application/vnd.github+json';

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#257bed',
  JavaScript: '#d99a2b',
  CSS: '#38ccd8',
  SCSS: '#38ccd8',
  HTML: '#ff90d4',
  Kotlin: '#8a6fb0',
  Swift: '#c98a5e',
  'Objective-C': '#7c9bb5',
  Java: '#b5773f',
  Ruby: '#c2261a',
  Shell: '#7c8a72',
  Dockerfile: '#6b6763',
  Python: '#4a7fb0',
};
const LANG_FALLBACK = ['#8f8984', '#a9a39e', '#b8b2ac'];

const langColor = (name: string, index: number): string =>
  LANG_COLORS[name] ?? LANG_FALLBACK[index % LANG_FALLBACK.length];

const compact = (n: number | undefined): string => {
  if (typeof n !== 'number') return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
};

const timeAgo = (iso?: string): string => {
  if (!iso) return '';
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 90) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d ago`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)}mo ago`;
  return `${Math.round(months / 12)}y ago`;
};

const fetchJson = async (url: string): Promise<unknown> => {
  try {
    const res = await fetch(url, { headers: { Accept: GITHUB_ACCEPT } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

type RepoResponse = {
  forks_count?: number;
  open_issues_count?: number;
  subscribers_count?: number;
  pushed_at?: string;
  license?: { spdx_id?: string; name?: string } | null;
};

const parseFacts = (repo: RepoResponse | null): RepoFacts | null => {
  if (!repo) return null;
  const spdx = repo.license?.spdx_id;
  const license = !spdx || spdx === 'NOASSERTION' ? repo.license?.name || 'AGPL-3.0' : spdx;
  return {
    forks: compact(repo.forks_count),
    issues: compact(repo.open_issues_count),
    watching: compact(repo.subscribers_count),
    license,
    lastPush: timeAgo(repo.pushed_at),
  };
};

const parseLanguages = (obj: Record<string, number> | null): RepoLanguage[] | null => {
  if (!obj) return null;
  const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
  const top = entries.slice(0, 6);
  const languages: RepoLanguage[] = top.map(([name, bytes], index) => ({
    name,
    pct: (bytes / total) * 100,
    color: langColor(name, index),
  }));
  const shown = top.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (total - shown > 0) {
    languages.push({
      name: 'Other',
      pct: ((total - shown) / total) * 100,
      color: 'var(--divider)',
    });
  }
  return languages;
};

type CommitResponse = {
  sha?: string;
  html_url?: string;
  commit?: { message?: string; author?: { name?: string; date?: string } };
  author?: { login?: string; avatar_url?: string };
};

const parseCommits = (list: CommitResponse[] | null): RepoCommit[] | null => {
  if (!Array.isArray(list)) return null;
  return list.slice(0, 5).map((c) => ({
    message: (c.commit?.message ?? '').split('\n')[0],
    login: c.author?.login ?? c.commit?.author?.name ?? 'unknown',
    avatar: c.author?.avatar_url ?? null,
    sha: (c.sha ?? '').slice(0, 7),
    when: timeAgo(c.commit?.author?.date),
    url: c.html_url ?? '#',
  }));
};

type ContributorResponse = {
  login?: string;
  avatar_url?: string;
  html_url?: string;
  type?: string;
};

const parseContributors = (list: ContributorResponse[] | null): RepoContributor[] | null => {
  if (!Array.isArray(list)) return null;
  return list
    .filter((u) => u?.login && u.type !== 'Bot')
    .slice(0, 9)
    .map((u) => ({ login: u.login as string, avatar: u.avatar_url ?? '', url: u.html_url ?? '#' }));
};

/** Commit-activity needs a warm cache on GitHub's side; a 202 means "come back". */
const fetchHeartbeat = async (attempt = 0): Promise<number[] | null> => {
  try {
    const res = await fetch(`${GITHUB_API_REPO}/stats/commit_activity`, {
      headers: { Accept: GITHUB_ACCEPT },
    });
    if (res.status === 202) {
      if (attempt >= 4) return null;
      await new Promise((resolve) => setTimeout(resolve, 1600));
      return fetchHeartbeat(attempt + 1);
    }
    if (!res.ok) return null;
    const list = (await res.json()) as Array<{ total?: number }> | null;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.map((week) => week.total ?? 0);
  } catch {
    return null;
  }
};

const loadRepoInsights = async (): Promise<RepoInsights> => {
  const [repo, langs, commits, contributors, heartbeat] = await Promise.all([
    fetchJson(GITHUB_API_REPO) as Promise<RepoResponse | null>,
    fetchJson(`${GITHUB_API_REPO}/languages`) as Promise<Record<string, number> | null>,
    fetchJson(`${GITHUB_API_REPO}/commits?per_page=6`) as Promise<CommitResponse[] | null>,
    fetchJson(`${GITHUB_API_REPO}/contributors?per_page=10`) as Promise<
      ContributorResponse[] | null
    >,
    fetchHeartbeat(),
  ]);
  const facts = parseFacts(repo);
  return {
    facts,
    forks: facts ? facts.forks : null,
    languages: parseLanguages(langs),
    commits: parseCommits(commits),
    contributors: parseContributors(contributors),
    heartbeat,
  };
};

// The Insights page mounts this hook twice (LiveConsole + RepositoryPulse). A
// single shared in-flight promise collapses a cold load to one set of GitHub
// requests instead of doubling them (including the slow commit-activity retry).
// There is deliberately NO persistent cache: the page pulls live on every visit,
// which is the whole "building in public" point and keeps its copy honest.
let inFlight: Promise<RepoInsights> | null = null;

const loadShared = (): Promise<RepoInsights> => {
  inFlight ??= loadRepoInsights().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

/**
 * Live repository metrics for the Insights page: languages, recent commits,
 * contributors, repo facts and a weekly commit heartbeat. Read straight from the
 * public GitHub API on every visit (no cache), sharing one in-flight fetch across
 * the page's hook instances. The initial value is a deterministic placeholder so
 * the server render and the first client render agree (no hydration mismatch).
 */
export function useRepoInsights(): RepoInsights {
  const [data, setData] = useState<RepoInsights>(EMPTY);

  useEffect(() => {
    let active = true;
    void (async () => {
      const next = await loadShared();
      if (active) setData(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  return data;
}
