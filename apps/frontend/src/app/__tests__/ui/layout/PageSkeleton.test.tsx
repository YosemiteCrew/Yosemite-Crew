import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

describe('PageSkeleton', () => {
  it('renders the generic shimmer skeleton with the spec eyebrow + caption', () => {
    const { container } = render(<PageSkeleton variant="generic" />);

    expect(screen.getByText('Page loading · skeleton')).toBeInTheDocument();
    expect(
      screen.getByText('Structure mirrors the loaded page. No spinners for full-page loads.')
    ).toBeInTheDocument();
    // Uses the ycShimmer keyframe class rather than a spinner.
    expect(container.querySelectorAll('.yc-shimmer').length).toBeGreaterThan(0);
  });

  it('renders each layout variant without error', () => {
    for (const variant of ['planner', 'list', 'settings', 'dashboard'] as const) {
      const { container, unmount } = render(<PageSkeleton variant={variant} />);
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
      unmount();
    }
  });

  it('defaults to the planner variant', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders the planner skeleton by default', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(container.textContent).toBe('');
  });

  it('renders the planner skeleton explicitly', () => {
    const { container } = render(<PageSkeleton variant="planner" />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders the list skeleton with 6 placeholder rows', () => {
    const { container } = render(<PageSkeleton variant="list" />);
    // 6 row placeholders keyed a-f, each has h-16 class
    expect(container.querySelectorAll('.h-16').length).toBe(6);
  });

  it('renders the settings skeleton with a sidebar and content panel', () => {
    const { container } = render(<PageSkeleton variant="settings" />);
    expect(container.querySelectorAll('.w-52').length).toBe(1);
  });

  it('renders the dashboard skeleton with 4 stat tiles and 4 cards', () => {
    const { container } = render(<PageSkeleton variant="dashboard" />);
    expect(container.querySelectorAll('.h-28').length).toBe(4);
    expect(container.querySelectorAll('.h-52').length).toBe(4);
  });
});
