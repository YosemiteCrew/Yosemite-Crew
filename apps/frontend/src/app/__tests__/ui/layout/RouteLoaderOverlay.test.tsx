import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import RouteLoaderOverlay from '@/app/ui/layout/RouteLoaderOverlay';
import { usePathname, useSearchParams } from 'next/navigation';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: jest.fn(),
  stopRouteLoader: jest.fn(),
}));

jest.mock('@/app/stores/routeLoaderStore', () => ({
  useRouteLoaderStore: jest.fn(),
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ testId }: any) => <div data-testid={testId}>loader</div>,
}));

describe('RouteLoaderOverlay', () => {
  const store = { isLoading: false };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (usePathname as jest.Mock).mockReturnValue('/appointments');
    (useSearchParams as jest.Mock).mockReturnValue({ toString: () => '' });
    (useRouteLoaderStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector(store)
    );
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('starts route loader on eligible internal anchor click', () => {
    render(<RouteLoaderOverlay />);

    const link = document.createElement('a');
    link.href = '/tasks?x=1';
    link.textContent = 'tasks';
    document.body.appendChild(link);

    fireEvent.click(link, { button: 0 });

    expect(startRouteLoader).toHaveBeenCalled();
  });

  it('ignores hash-only and external links', () => {
    render(<RouteLoaderOverlay />);

    const hashLink = document.createElement('a');
    hashLink.href = '#section';
    document.body.appendChild(hashLink);

    const external = document.createElement('a');
    external.href = 'https://other.site/page';
    document.body.appendChild(external);

    fireEvent.click(hashLink, { button: 0 });
    fireEvent.click(external, { button: 0 });

    expect(startRouteLoader).not.toHaveBeenCalled();
  });

  it('auto-stops loader after timeout when loading remains true', () => {
    store.isLoading = true;
    render(<RouteLoaderOverlay />);

    expect(screen.getByTestId('global-route-loader')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(15000);
    });

    expect(stopRouteLoader).toHaveBeenCalled();
    store.isLoading = false;
  });
});
