import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReleaseInfo } from '@/app/features/marketing/site/useGithubStats';

const latest: ReleaseInfo = {
  tag: 'v2.0.0-beta',
  date: 'Jul 2, 2026',
  url: 'https://github.com/YosemiteCrew/Yosemite-Crew/releases/tag/v2',
};
const mobile: ReleaseInfo = {
  tag: 'v1.2',
  date: 'Jun 30, 2026',
  url: 'https://github.com/YosemiteCrew/Yosemite-Crew/releases/tag/m1',
};
const empty: ReleaseInfo = { tag: null, date: null, url: null };

let latestValue: ReleaseInfo = latest;
let mobileValue: ReleaseInfo = mobile;

jest.mock('@/app/features/marketing/site/useGithubStats', () => ({
  useLatestRelease: () => latestValue,
  useMobileRelease: () => mobileValue,
}));

import { ReleasePill } from '@/app/features/marketing/site/ReleasePill';

describe('ReleasePill', () => {
  beforeEach(() => {
    latestValue = latest;
    mobileValue = mobile;
  });

  it('renders the Home "Latest release" variant with the live tag and link', () => {
    render(<ReleasePill variant="latest" version="v2.0 beta" />);
    expect(screen.getByText('Latest release')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', latest.url);
    expect(link).toHaveTextContent('v2.0.0-beta');
  });

  it('falls back to the hard-coded version when no live tag resolved (latest)', () => {
    latestValue = empty;
    render(<ReleasePill variant="latest" version="v2.0 beta" />);
    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('v2.0 beta');
    expect(link).toHaveAttribute('href', 'https://github.com/YosemiteCrew/Yosemite-Crew/releases');
  });

  it('renders the platform variant with only its hard-coded copy, no desktop metadata', () => {
    render(<ReleasePill variant="platform" label="Platform PIMS" version="v2.0 beta" />);
    expect(screen.getByText('Platform PIMS')).toBeInTheDocument();
    // The repo-wide "latest release" is a desktop build, so the platform pill must not
    // borrow its tag, date, or URL: it shows only hard-coded copy + the releases index.
    expect(screen.getByText('v2.0 beta')).toBeInTheDocument();
    expect(screen.queryByText('v2.0.0-beta')).not.toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).not.toHaveTextContent('Jul 2, 2026');
    expect(link).toHaveAttribute('href', 'https://github.com/YosemiteCrew/Yosemite-Crew/releases');
  });

  it('renders the mobile variant with the live tag and link', () => {
    render(<ReleasePill variant="mobile" label="Mobile app" version="v1.2 beta" />);
    expect(screen.getByText('Mobile app')).toBeInTheDocument();
    expect(screen.getByText('v1.2')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', mobile.url);
  });

  it('falls back to the hard-coded version when no mobile tag resolved', () => {
    mobileValue = empty;
    render(<ReleasePill variant="mobile" label="Mobile app" version="v1.2 beta" />);
    expect(screen.getByText('v1.2 beta')).toBeInTheDocument();
  });

  it('renders the static variant without a live date and uses the provided href', () => {
    render(
      <ReleasePill
        variant="static"
        label="Developer portal"
        version="Coming soon"
        href="/developers/signup"
      />
    );
    expect(screen.getByText('Developer portal')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/developers/signup');
  });

  it('never borrows a fully-resolved desktop release on the platform pill', () => {
    latestValue = latest; // desktop release fully resolved (tag + date + url)
    render(<ReleasePill variant="platform" label="Platform PIMS" version="v2.0 beta" />);
    const link = screen.getByRole('link');
    expect(link).not.toHaveTextContent('Jul 2, 2026');
    expect(link).not.toHaveAttribute('href', latest.url);
  });
});
