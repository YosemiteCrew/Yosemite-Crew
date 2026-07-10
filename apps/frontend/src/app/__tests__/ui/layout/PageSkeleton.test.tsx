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
});
