'use client';

import { useEffect, useState } from 'react';
import { GITHUB_API_REPO } from './assets';

export interface GithubContributor {
  login: string;
  avatarSrc: string;
  href: string;
}

type GithubContributorResponse = {
  login?: string;
  avatar_url?: string;
  html_url?: string;
  type?: string;
};

const GITHUB_CONTRIBUTORS_API = `${GITHUB_API_REPO}/contributors?per_page=100&anon=true`;

const BOT_LOGIN_PATTERN = /(\[bot\]|^turbobot-)/i;

const parseGithubContributors = (
  contributors: GithubContributorResponse[] | null
): GithubContributor[] | null => {
  if (!Array.isArray(contributors)) return null;
  const parsed: GithubContributor[] = [];
  for (const contributor of contributors) {
    // turbobot-temp is type 'User' on GitHub but is Turborepo's scaffold bot,
    // so a type check alone still renders it as a human face on the roster.
    if (
      !contributor?.login ||
      contributor.type === 'Bot' ||
      BOT_LOGIN_PATTERN.test(contributor.login)
    ) {
      continue;
    }
    parsed.push({
      login: contributor.login,
      avatarSrc: contributor.avatar_url ?? '',
      href: contributor.html_url ?? `https://github.com/${contributor.login}`,
    });
  }
  return parsed;
};

export function useGithubContributors(): GithubContributor[] | null {
  const [contributors, setContributors] = useState<GithubContributor[] | null>(null);

  useEffect(() => {
    // AbortController rather than a boolean flag so unmounting actually cancels
    // the in-flight request instead of only ignoring its answer.
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(GITHUB_CONTRIBUTORS_API, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const json = (await response.json()) as GithubContributorResponse[] | null;
        if (controller.signal.aborted) return;
        setContributors(parseGithubContributors(json));
      } catch {
        if (!controller.signal.aborted) setContributors(null);
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  return contributors;
}
