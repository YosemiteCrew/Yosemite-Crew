import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
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

  it('renders an empty live region on the server', () => {
    expect(renderToString(<RouteAnnouncer />)).toBe(
      '<div class="sr-only" aria-live="polite" aria-atomic="true"></div>'
    );
  });

  it('announces "Page updated" when document title is empty', () => {
    document.title = '';
    render(<RouteAnnouncer />);

    expect(screen.getByText('Page updated')).toBeInTheDocument();
  });

  it('announces the new title when metadata updates after client navigation', async () => {
    const { rerender, unmount } = render(<RouteAnnouncer />);
    expect(screen.getByText('Pricing loaded')).toBeInTheDocument();

    act(() => {
      mockUsePathname.mockReturnValue('/appointments');
    });
    rerender(<RouteAnnouncer />);

    act(() => {
      document.title = 'Dashboard';
    });

    expect(await screen.findByText('Dashboard loaded')).toBeInTheDocument();

    unmount();
    act(() => {
      document.title = 'Appointments';
    });
    expect(screen.queryByText('Appointments loaded')).not.toBeInTheDocument();
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
