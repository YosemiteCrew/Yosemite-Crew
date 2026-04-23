import React from 'react';
import { render } from '@testing-library/react';
import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';
import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';

const TestHarness = ({ source, isActive }: { source: string; isActive: boolean }) => {
  useFullscreenLoader(source, isActive);
  return null;
};

describe('useFullscreenLoader', () => {
  beforeEach(() => {
    useFullscreenLoaderStore.setState({ activeSources: {} });
  });

  it('registers and unregisters an active fullscreen loader source', () => {
    const { rerender } = render(<TestHarness source="appointments" isActive />);

    expect(useFullscreenLoaderStore.getState().activeSources).toEqual({ appointments: true });

    rerender(<TestHarness source="appointments" isActive={false} />);

    expect(useFullscreenLoaderStore.getState().activeSources).toEqual({});
  });

  it('cleans up the source on unmount', () => {
    const view = render(<TestHarness source="org-guard" isActive />);

    expect(useFullscreenLoaderStore.getState().activeSources).toEqual({ 'org-guard': true });

    view.unmount();

    expect(useFullscreenLoaderStore.getState().activeSources).toEqual({});
  });
});
