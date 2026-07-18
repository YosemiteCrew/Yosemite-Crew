import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Home } from '@/app/features/marketing/pages/Home/Home';

type StatsShape = {
  stars: string | null;
  starsFull: string | null;
  selfHosters: string | null;
  contributors: string | null;
  discord: string | null;
};
const DEFAULT_STATS: StatsShape = {
  stars: '2.4k',
  starsFull: '2,400',
  selfHosters: '67,134',
  contributors: '128',
  discord: '3,210',
};
const EMPTY_STATS: StatsShape = {
  stars: null,
  starsFull: null,
  selfHosters: null,
  contributors: null,
  discord: null,
};
// Reassigned per test so the null-stat placeholder path can be exercised.
let mockStats: StatsShape = DEFAULT_STATS;

jest.mock('next/image', () => ({
  __esModule: true,
  default: jest.requireActual('@/app/__tests__/support/marketingTestMocks').NextImageMock,
}));

jest.mock('@/app/features/marketing/site', () => {
  const React_ = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    Reveal: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) =>
      React_.createElement('div', { style }, children),
    Spotlight: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) =>
      React_.createElement('div', { style }, children),
    HeroVideo: () => null,
    HeroGlow: () => null,
    ctaBandContainerStyle: () => ({}),
    ReleasePill: () => React_.createElement('span', null, 'Latest release'),
    CountUp: ({ value }: { value: string }) => React_.createElement('span', null, value),
    useMagnet: () => React_.createRef(),
    useParallax: () => React_.createRef(),
    InkAnnotate: ({ children }: { children: React.ReactNode }) => children,
    useGithubStats: () => mockStats,
    HERO_AVATARS: ['/a.png', '/b.png', '/c.png'],
    COMPANION_PHOTOS: { dog: '/dog.webp', horse: '/horse.webp', cat: '/cat.webp' },
    HERO_VIDEOS: { home: 'https://cdn.example/hero.mp4' },
    HERO_POSTERS: { home: 'https://cdn.example/hero.jpg' },
    GITHUB_REPO_URL: 'https://github.com/YosemiteCrew/Yosemite-Crew',
  };
});

describe('Home marketing page', () => {
  beforeEach(() => {
    mockStats = DEFAULT_STATS;
    render(<Home />);
  });

  it('renders the split hero headline', () => {
    expect(screen.getByText('See')).toBeInTheDocument();
    expect(screen.getByText('whole')).toBeInTheDocument();
    expect(screen.getByText('animal.')).toBeInTheDocument();
  });

  it('renders the audience pillar headings', () => {
    expect(screen.getByText('Run the practice, not the software.')).toBeInTheDocument();
    expect(screen.getByText('The whole story, in your pocket.')).toBeInTheDocument();
    expect(screen.getByText('Build on an open spine.')).toBeInTheDocument();
  });

  it('renders the companion framing heading', () => {
    expect(screen.getByText('Canine, equine, feline. One record for each.')).toBeInTheDocument();
  });

  it('links each audience pillar to its route', () => {
    expect(screen.getByRole('link', { name: /Explore the practice suite/i })).toHaveAttribute(
      'href',
      '/pet-businesses'
    );
    expect(screen.getByRole('link', { name: /See the companion app/i })).toHaveAttribute(
      'href',
      '/pet-parents'
    );
    expect(screen.getByRole('link', { name: /Read the developer docs/i })).toHaveAttribute(
      'href',
      '/developers'
    );
  });

  it('renders the live metrics grid labels', () => {
    expect(screen.getByText('Self-hosters')).toBeInTheDocument();
    expect(screen.getByText('Contributors')).toBeInTheDocument();
    expect(screen.getByText('Discord members')).toBeInTheDocument();
    expect(screen.getByText('Repo stars')).toBeInTheDocument();
  });

  it('renders the closing CTA', () => {
    expect(screen.getByText('Start tonight. Leave whenever.')).toBeInTheDocument();
    const primaryCtas = screen.getAllByRole('link', { name: /Get started free/i });
    expect(primaryCtas.length).toBeGreaterThan(0);
    expect(primaryCtas[0]).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: /Talk to us/i })).toHaveAttribute(
      'href',
      '/contact-us'
    );
  });
});

describe('Home marketing page with no live stats yet', () => {
  it('falls back to a placeholder for every still-null stat', () => {
    mockStats = EMPTY_STATS;
    render(<Home />);
    // Hero social proof plus the four-metric grid all render the '·' placeholder.
    expect(screen.getAllByText('·').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/Trusted by/)).toBeInTheDocument();
  });
});
