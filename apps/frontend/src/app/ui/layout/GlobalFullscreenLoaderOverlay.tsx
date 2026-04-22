'use client';

import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';
import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';
import GlobalFullscreenLoader from '@/app/ui/layout/GlobalFullscreenLoader';

const hasActiveSources = (activeSources: Record<string, true>) =>
  Object.keys(activeSources).length > 0;

const GlobalFullscreenLoaderOverlay = () => {
  const isRouteLoading = useRouteLoaderStore((s) => s.isLoading);
  const isBlockingLoading = useFullscreenLoaderStore((s) => hasActiveSources(s.activeSources));

  if (!isRouteLoading && !isBlockingLoading) return null;

  return <GlobalFullscreenLoader />;
};

export default GlobalFullscreenLoaderOverlay;
