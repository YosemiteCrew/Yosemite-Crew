import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => {
  const Link = ({ href, children, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  );
  return { __esModule: true, default: Link };
});

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

const stats = {
  stars: '2k',
  starsFull: '2,049',
  selfHosters: '101,807',
  contributors: '28',
  discord: '196',
};
const release = { tag: 'v0.1.0-beta.2', date: 'Jul 2, 2026', url: 'https://gh/releases/latest' };
const repo = {
  facts: { forks: '128', issues: '12', watching: '34', license: 'AGPL-3.0', lastPush: '2h ago' },
  forks: '128',
  languages: [
    { name: 'TypeScript', pct: 80, color: '#257bed' },
    { name: 'CSS', pct: 20, color: '#38ccd8' },
  ],
  commits: [
    {
      message: 'feat: add the insights page',
      login: 'ada',
      avatar: null,
      sha: 'abcdef1',
      when: '2h ago',
      url: 'https://gh/c/1',
    },
  ],
  contributors: [{ login: 'ada', avatar: 'https://av/ada.png', url: 'https://gh/ada' }],
  heartbeat: [1, 5, 3, 9],
};

jest.mock('@/app/features/marketing/site', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    Reveal: ({ children, as = 'div', style }: any) => R.createElement(as, { style }, children),
    Spotlight: ({ children }: any) => R.createElement('div', null, children),
    HeroGlow: () => null,
    CountUp: ({ value }: any) => R.createElement('span', null, value),
    InkAnnotate: ({ children }: any) => children,
    GITHUB_REPO_URL: 'https://github.com/YosemiteCrew/Yosemite-Crew',
    DISCORD_INVITE_URL: 'https://discord.gg/yosemitecrew',
    useGithubStats: () => stats,
    useLatestRelease: () => release,
    useRepoInsights: () => repo,
  };
});

import { Insights } from '@/app/features/marketing/pages/Insights/Insights';

describe('Insights page', () => {
  test('renders the hero and its live self-hoster proof', () => {
    render(<Insights />);
    // The heading is real text (with spaces) so its accessible name reads cleanly.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'We build in the open. Numbers included.'
    );
    expect(screen.getByText('Numbers included.')).toBeInTheDocument();
    expect(screen.getByText('Building in public')).toBeInTheDocument();
  });

  test('renders the four live community stats with their labels', () => {
    render(<Insights />);
    expect(screen.getByText('Self-hosters')).toBeInTheDocument();
    expect(screen.getByText('101,807')).toBeInTheDocument();
    expect(screen.getByText('Discord members')).toBeInTheDocument();
    expect(screen.getByText('196')).toBeInTheDocument();
    expect(screen.getByText('GitHub stars')).toBeInTheDocument();
  });

  test('renders live repository pulse data from the hooks', () => {
    render(<Insights />);
    expect(
      screen.getByRole('heading', { name: 'The repository, in real time.' })
    ).toBeInTheDocument();
    // Languages + legend
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    // Latest release
    expect(screen.getByText('v0.1.0-beta.2')).toBeInTheDocument();
    // Commit + facts + contributor
    expect(screen.getByText('feat: add the insights page')).toBeInTheDocument();
    expect(screen.getByText('AGPL-3.0')).toBeInTheDocument();
    expect(screen.getByAltText('ada')).toBeInTheDocument();
  });

  test('renders the principles and closing CTA', () => {
    render(<Insights />);
    expect(
      screen.getByRole('heading', { name: 'Transparency is a habit, not a page.' })
    ).toBeInTheDocument();
    expect(screen.getByText('Honest by default')).toBeInTheDocument();
    expect(screen.getByText(/Read the numbers\./)).toBeInTheDocument();
    expect(screen.getByText('Then read the code.')).toBeInTheDocument();
  });
});
