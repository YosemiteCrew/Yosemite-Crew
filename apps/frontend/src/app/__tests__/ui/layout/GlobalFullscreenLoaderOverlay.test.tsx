import React from 'react';
import { render, screen } from '@testing-library/react';
import GlobalFullscreenLoaderOverlay from '@/app/ui/layout/GlobalFullscreenLoaderOverlay';
import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';
import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';

jest.mock('@/app/ui/layout/GlobalFullscreenLoader', () => ({
  __esModule: true,
  default: ({ testId }: { testId?: string }) => (
    <div data-testid={testId ?? 'global-fullscreen-loader'}>loading</div>
  ),
}));

describe('GlobalFullscreenLoaderOverlay', () => {
  beforeEach(() => {
    useFullscreenLoaderStore.setState({ activeSources: {} });
    useRouteLoaderStore.setState({ isLoading: false });
  });

  it('renders when a blocking fullscreen source is active', () => {
    useFullscreenLoaderStore.setState({ activeSources: { 'org-guard': true } });

    render(<GlobalFullscreenLoaderOverlay />);

    expect(screen.getByTestId('global-fullscreen-loader')).toBeInTheDocument();
  });

  it('renders when the route loader is active', () => {
    useRouteLoaderStore.setState({ isLoading: true });

    render(<GlobalFullscreenLoaderOverlay />);

    expect(screen.getByTestId('global-fullscreen-loader')).toBeInTheDocument();
  });

  it('renders nothing when no fullscreen loader source is active', () => {
    const { container } = render(<GlobalFullscreenLoaderOverlay />);

    expect(container).toBeEmptyDOMElement();
  });
});
