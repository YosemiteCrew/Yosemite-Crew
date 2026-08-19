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

const parseGithubContributors = (
  contributors: GithubContributorResponse[] | null
): GithubContributor[] | null => {
  if (!Array.isArray(contributors)) return null;
  return (
    contributors
      // turbobot-temp is type 'User' on GitHub but is Turborepo's scaffold bot,
      // so a type check alone still renders it as a human face on the roster.
      .filter(
        (contributor) =>
          contributor?.login &&
          contributor.type !== 'Bot' &&
          !/(\[bot\]|^turbobot-)/i.test(contributor.login)
      )
      .map((contributor) => ({
        login: contributor.login as string,
        avatarSrc: contributor.avatar_url ?? '',
        href: contributor.html_url ?? `https://github.com/${contributor.login}`,
      }))
  );
};

export function useGithubContributors(): GithubContributor[] | null {
  const [contributors, setContributors] = useState<GithubContributor[] | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch(GITHUB_CONTRIBUTORS_API, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!response.ok) return;
        const json = (await response.json()) as GithubContributorResponse[] | null;
        if (!active) return;
        setContributors(parseGithubContributors(json));
      } catch {
        if (active) setContributors(null);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return contributors;
}
