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
const platform: ReleaseInfo = {
  tag: 'v2.1.0-beta',
  date: 'Jul 13, 2026',
  url: 'https://github.com/YosemiteCrew/Yosemite-Crew/releases/tag/pims-v2.1.0-beta',
};
const empty: ReleaseInfo = { tag: null, date: null, url: null };

let latestValue: ReleaseInfo = latest;
let mobileValue: ReleaseInfo = mobile;
let platformValue: ReleaseInfo = platform;

const mockUseLatestRelease = jest.fn((): ReleaseInfo => latestValue);
const mockUseMobileRelease = jest.fn((): ReleaseInfo => mobileValue);
const mockUsePlatformRelease = jest.fn((): ReleaseInfo => platformValue);

jest.mock('@/app/features/marketing/site/useGithubStats', () => ({
  useLatestRelease: () => mockUseLatestRelease(),
  useMobileRelease: () => mockUseMobileRelease(),
  usePlatformRelease: () => mockUsePlatformRelease(),
}));

import { ReleasePill } from '@/app/features/marketing/site/ReleasePill';

describe('ReleasePill', () => {
  beforeEach(() => {
    latestValue = latest;
    mobileValue = mobile;
    platformValue = platform;
    mockUseLatestRelease.mockClear();
    mockUseMobileRelease.mockClear();
    mockUsePlatformRelease.mockClear();
  });

  it('fetches only the release endpoint the variant needs, not all of them', () => {
    const { unmount } = render(<ReleasePill variant="latest" version="v2.0 beta" />);
    expect(mockUseLatestRelease).toHaveBeenCalled();
    expect(mockUseMobileRelease).not.toHaveBeenCalled();
    expect(mockUsePlatformRelease).not.toHaveBeenCalled();
    unmount();

    mockUseLatestRelease.mockClear();
    render(<ReleasePill variant="platform" label="Platform PIMS" version="v2.1.0-beta" />);
    expect(mockUsePlatformRelease).toHaveBeenCalled();
    expect(mockUseLatestRelease).not.toHaveBeenCalled();
    expect(mockUseMobileRelease).not.toHaveBeenCalled();
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

  it('renders the platform variant with the live PIMS tag, publish date and release link', () => {
    render(<ReleasePill variant="platform" label="Platform PIMS" version="v2.0 beta" />);
    expect(screen.getByText('Platform PIMS')).toBeInTheDocument();
    const link = screen.getByRole('link');
    // Shows the real PIMS release version + date, not the stale hard-coded copy.
    expect(link).toHaveTextContent('v2.1.0-beta');
    expect(link).toHaveTextContent('Jul 13, 2026');
    expect(screen.queryByText('v2.0 beta')).not.toBeInTheDocument();
    expect(link).toHaveAttribute('href', platform.url);
  });

  it('falls back to the hard-coded version (no date) when no platform release resolved', () => {
    platformValue = empty;
    render(<ReleasePill variant="platform" label="Platform PIMS" version="v2.1.0-beta" />);
    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('v2.1.0-beta');
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
