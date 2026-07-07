import React from 'react';
import { render } from '@testing-library/react';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

describe('PageSkeleton', () => {
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
