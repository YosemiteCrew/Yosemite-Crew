import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

const mockUsePathname = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

import RouteAnnouncer from '@/app/ui/layout/RouteAnnouncer';

expect.extend(toHaveNoViolations);

describe('RouteAnnouncer', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/pricing');
    mockUseSearchParams.mockReturnValue(new URLSearchParams(''));
    document.title = 'Pricing';
  });

  it('announces the current document title', () => {
    render(<RouteAnnouncer />);

    expect(screen.getByText('Pricing loaded')).toBeInTheDocument();
  });

  it('announces "Page updated" when document title is empty', () => {
    document.title = '';
    render(<RouteAnnouncer />);

    expect(screen.getByText('Page updated')).toBeInTheDocument();
  });

  it('re-announces on pathname change', () => {
    const { rerender } = render(<RouteAnnouncer />);
    expect(screen.getByText('Pricing loaded')).toBeInTheDocument();

    act(() => {
      document.title = 'Dashboard';
      mockUsePathname.mockReturnValue('/appointments');
    });

    rerender(<RouteAnnouncer />);
    expect(screen.getByText('Dashboard loaded')).toBeInTheDocument();
  });

  it('live region is aria-live="polite" and aria-atomic="true"', () => {
    const { container } = render(<RouteAnnouncer />);
    const region = container.firstChild as HTMLElement;

    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<RouteAnnouncer />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
