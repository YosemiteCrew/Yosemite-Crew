import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReleaseLane } from '@/app/features/marketing/site/useGithubStats';

const RESOLVED: ReleaseLane[] = [
  {
    key: 'pims',
    label: 'PIMS',
    tag: 'v2.3.0-beta',
    date: 'Aug 19, 2026',
    dateCompact: '19 Aug',
    url: 'https://github.com/YosemiteCrew/Yosemite-Crew/releases/tag/pims-v2.3.0-beta',
  },
  {
    key: 'desktop',
    label: 'Desktop',
    tag: 'v0.1.0-beta.4',
    date: 'Aug 19, 2026',
    dateCompact: '19 Aug',
    url: 'https://github.com/YosemiteCrew/Yosemite-Crew/releases/tag/v0.1.0-beta.4',
  },
  {
    key: 'mobile',
    label: 'Mobile',
    tag: 'v1.6.1',
    date: 'Aug 21, 2026',
    dateCompact: '21 Aug',
    url: 'https://github.com/YosemiteCrew/Yosemite-Crew/releases/tag/mobile-v1.6.1',
  },
  {
    key: 'backend',
    label: 'Backend',
    tag: null,
    date: null,
    dateCompact: null,
    url: null,
  },
];

let lanesValue: ReleaseLane[] = RESOLVED;
const mockUseReleaseLanes = jest.fn((): ReleaseLane[] => lanesValue);

jest.mock('@/app/features/marketing/site/useGithubStats', () => ({
  useReleaseLanes: () => mockUseReleaseLanes(),
}));

import { ReleaseLanes } from '@/app/features/marketing/site/ReleaseLanes';

const RELEASES_INDEX = 'https://github.com/YosemiteCrew/Yosemite-Crew/releases';

beforeEach(() => {
  lanesValue = RESOLVED;
  jest.clearAllMocks();
});

describe('ReleaseLanes', () => {
  it('renders one link per shipped component', () => {
    render(<ReleaseLanes />);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    for (const label of ['PIMS', 'Desktop', 'Mobile', 'Backend']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows the version and compact date, and links to that release', () => {
    render(<ReleaseLanes />);
    const desktop = screen.getByRole('link', { name: /Desktop v0\.1\.0-beta\.4/ });
    expect(desktop).toHaveAttribute('href', RESOLVED[1].url);
    expect(desktop).toHaveAttribute('target', '_blank');
    expect(desktop).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText('v0.1.0-beta.4')).toBeInTheDocument();
    expect(screen.getAllByText('19 Aug').length).toBeGreaterThanOrEqual(1);
  });

  it('names the full date for assistive tech, not the abbreviated one', () => {
    // The face is abbreviated to keep the strip short; the accessible name must not be.
    render(<ReleaseLanes />);
    expect(
      screen.getByRole('link', { name: 'Mobile v1.6.1, released Aug 21, 2026' })
    ).toBeInTheDocument();
  });

  it('falls back to the releases index for a lane with no release', () => {
    // Backend resolved to nulls here. It must still lead somewhere useful, must not borrow
    // another lane's URL, and must not print a version it does not have.
    render(<ReleaseLanes />);
    const backend = screen.getByRole('link', { name: 'Backend releases on GitHub' });
    expect(backend).toHaveAttribute('href', RELEASES_INDEX);
    expect(backend).toHaveTextContent('·');
    expect(backend).not.toHaveTextContent(/v\d/);
  });

  it('renders placeholders for every lane before the fetch resolves', () => {
    lanesValue = RESOLVED.map((lane) => ({
      ...lane,
      tag: null,
      date: null,
      dateCompact: null,
      url: null,
    }));
    render(<ReleaseLanes />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link).toHaveAttribute('href', RELEASES_INDEX);
      expect(link).not.toHaveTextContent(/v\d/);
    }
  });

  it('names a release that has a tag but no publish date', () => {
    // GitHub can return a release with no published_at (a draft promoted oddly), which leaves
    // the date null while the tag resolves. The name still has to read as a sentence.
    lanesValue = [{ ...RESOLVED[0], date: null, dateCompact: null }];
    render(<ReleaseLanes />);
    expect(
      screen.getByRole('link', { name: 'PIMS v2.3.0-beta, released recently' })
    ).toBeInTheDocument();
    expect(screen.queryByText('19 Aug')).not.toBeInTheDocument();
  });

  it('separates the lanes without adding them to the accessible names', () => {
    const { container } = render(<ReleaseLanes />);
    // Three hairlines between four lanes, all hidden from the accessibility tree.
    const hidden = container.querySelectorAll('span[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('link', { name: /^PIMS/ })).toBeInTheDocument();
  });
});
