import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';

export const startRouteLoader = () => {
  useRouteLoaderStore.getState().start();
};

export const stopRouteLoader = () => {
  useRouteLoaderStore.getState().stop();
};

/**
 * RouteLoaderOverlay releases the org-switch loader when the pathname or query
 * changes. Pushing the route we are already on fires neither, so callers have to
 * release it themselves.
 */
export const isCurrentRoute = (route: string) => {
  const next = new URL(route, globalThis.window.location.origin);
  return (
    next.pathname === globalThis.window.location.pathname &&
    next.search === globalThis.window.location.search
  );
};
