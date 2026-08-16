import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => {
  const Link = React.forwardRef<HTMLAnchorElement, any>(function Link(
    { href, children, ...rest },
    ref
  ) {
    return (
      <a ref={ref} href={typeof href === 'string' ? href : '#'} {...rest}>
        {children}
      </a>
    );
  });
  return { __esModule: true, default: Link };
});

jest.mock('next/image', () => ({
  __esModule: true,
  default: jest.requireActual('@/app/__tests__/support/marketingTestMocks').NextImageMock,
}));

const mockStats = {
  stars: '2.4k',
  starsFull: '2,431',
  selfHosters: '67,134',
  contributors: '58',
  discord: '412',
};

const mockGithubContributors = [
  {
    login: 'ada',
    avatarSrc: 'https://avatars.githubusercontent.com/u/1?v=4',
    href: 'https://github.com/ada',
  },
  {
    login: 'grace',
    avatarSrc: 'https://avatars.githubusercontent.com/u/2?v=4',
    href: 'https://github.com/grace',
  },
  {
    login: 'linus',
    avatarSrc: 'https://avatars.githubusercontent.com/u/3?v=4',
    href: 'https://github.com/linus',
  },
];

jest.mock('@/app/features/marketing/site', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    Reveal: ({ children, as = 'div', className, style }: any) =>
      R.createElement(as, { className, style }, children),
    Spotlight: ({ children, style }: any) => R.createElement('div', { style }, children),
    HeroGlow: () => null,
    InkAnnotate: ({ children }: any) => children,
    CountUp: ({ value, className, style }: any) =>
      R.createElement('span', { className, style }, value),
    useGithubStats: () => mockStats,
    useGithubContributors: () => mockGithubContributors,
    ABOUT_ORIGIN_PHOTO: '/images/marketing/about-origin.webp',
    GITHUB_REPO_URL: 'https://github.com/YosemiteCrew/Yosemite-Crew',
    DISCORD_INVITE_URL: 'https://discord.gg/yosemitecrew',
  };
});

import { About } from '@/app/features/marketing/pages/About/About';

describe('About (marketing)', () => {
  test('renders the hero heading and origin story', () => {
    render(<About />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('We');
    expect(h1).toHaveTextContent('build');
    expect(h1).toHaveTextContent('layer');
    expect(h1).toHaveTextContent('underneath.');

    expect(screen.getByText(/Not another app for the grieving pet parent/i)).toBeInTheDocument();

    expect(screen.getByText('Where this started')).toBeInTheDocument();
    expect(screen.getByText(/He died because the clinic couldn't see him\./i)).toBeInTheDocument();
  });

  test('renders all six beliefs', () => {
    render(<About />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Six things we won't quietly walk back\./i,
      })
    ).toBeInTheDocument();

    expect(screen.getByText('Leaving is free')).toBeInTheDocument();
    expect(screen.getByText('No toll booth')).toBeInTheDocument();
    expect(screen.getByText('Built for the worst afternoon')).toBeInTheDocument();
    expect(screen.getByText('Your data answers to your flag')).toBeInTheDocument();
    expect(screen.getByText("If it isn't written down, it didn't happen")).toBeInTheDocument();
    expect(screen.getByText('Small on purpose')).toBeInTheDocument();
  });

  test('renders live stats from the github stats hook', () => {
    render(<About />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Most companies keep their numbers private\. We don't\./i,
      })
    ).toBeInTheDocument();

    expect(screen.getByText('67,134')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
    expect(screen.getByText('412')).toBeInTheDocument();
    expect(screen.getByText('2,431')).toBeInTheDocument();

    expect(screen.getByText('Self-hosters')).toBeInTheDocument();
    expect(screen.getByText('Contributors')).toBeInTheDocument();
    expect(screen.getByText('Discord members')).toBeInTheDocument();
    expect(screen.getByText('Repo stars')).toBeInTheDocument();
  });

  test('renders the contributors with linkedin links', () => {
    const { container } = render(<About />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Everyone who helped build Yosemite Crew\./i,
      })
    ).toBeInTheDocument();

    const ankit = screen.getByRole('link', {
      name: /Ankit Upadhyay, Founder and contributor, on LinkedIn/i,
    });
    expect(ankit).toHaveAttribute('href', 'https://www.linkedin.com/in/aupyay/');
    expect(ankit).toHaveAttribute('target', '_blank');
    expect(ankit).toHaveAttribute('rel', 'noopener noreferrer');

    expect(
      screen.getByRole('link', {
        name: /Harshvardhan Parmar, Contributor, on LinkedIn/i,
      })
    ).toHaveAttribute('href', 'https://www.linkedin.com/in/harshvardhan-parmar/');
    // Departed members are no longer listed in the core team.
    expect(
      screen.queryByRole('link', { name: /Sneha, Contributor, on LinkedIn/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: /Vallirani Ravulapati, Contributor, on LinkedIn/i,
      })
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(
        'img[src="https://d2il6osz49gpup.cloudfront.net/aboutus-page/Ankit_profile.png"]'
      )
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        'img[src="https://d2il6osz49gpup.cloudfront.net/aboutus-page/harshvardhan-profile_pic.png"]'
      )
    ).toBeInTheDocument();
  });

  test('renders the live github contributor roster with matching card styling', () => {
    render(<About />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Everyone who helped build Yosemite Crew\./i,
      })
    ).toBeInTheDocument();

    expect(screen.getByText('Live GitHub contributors')).toBeInTheDocument();
    expect(
      screen.getByText(/This list loads directly from GitHub, so the roster stays current/i)
    ).toBeInTheDocument();

    const githubContributorLinks = screen.getAllByRole('link', {
      name: /GitHub contributor, on GitHub/i,
    });
    expect(githubContributorLinks).toHaveLength(3);

    expect(
      screen.getByRole('link', { name: /grace, GitHub contributor, on GitHub/i })
    ).toHaveAttribute('href', 'https://github.com/grace');
    expect(
      screen.getByRole('link', { name: /linus, GitHub contributor, on GitHub/i })
    ).toHaveAttribute('href', 'https://github.com/linus');
  });

  test('renders the legal entity block', () => {
    render(<About />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Made in Mainz, owned by no one else\./i,
      })
    ).toBeInTheDocument();

    expect(screen.getByText('Legal entity')).toBeInTheDocument();
    expect(screen.getByText('DuneXploration UG (haftungsbeschränkt)')).toBeInTheDocument();
    expect(screen.getByText('Based in')).toBeInTheDocument();
    expect(screen.getByText('Licence')).toBeInTheDocument();
    expect(screen.getByText('AGPL-3.0 · you own the software')).toBeInTheDocument();
    expect(screen.getByText('Registered')).toBeInTheDocument();
    expect(screen.getByText(/Amtsgericht Mainz HRB 52778/)).toBeInTheDocument();
    expect(screen.getByText(/VAT DE367920596/)).toBeInTheDocument();
  });

  test('renders the closing CTA with github and contact links', () => {
    render(<About />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Help us build the layer underneath\./i,
      })
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Star on GitHub/i })).toHaveAttribute(
      'href',
      'https://github.com/YosemiteCrew/Yosemite-Crew'
    );

    expect(screen.getByRole('link', { name: /Talk to us/i })).toHaveAttribute(
      'href',
      '/contact-us'
    );
  });
});
