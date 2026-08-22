import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';

export const startRouteLoader = () => {
  useRouteLoaderStore.getState().start();
};

export const stopRouteLoader = () => {
  useRouteLoaderStore.getState().stop();
};

/**
 * True when `route` is the route already being displayed.
 *
 * RouteLoaderOverlay releases the org-switch loader from an effect keyed on the
 * pathname and query, so pushing the route we are already on fires neither and
 * the loader is never released. Callers that push a route which may be the
 * current one must therefore release it themselves.
 *
 * That is not a hypothetical: `resolveOrgScopedRedirect` returns
 * `/organizations` whenever the org or membership is missing from the store, and
 * the organisation picker lives at `/organizations` - so choosing such an
 * organisation pushed the page onto itself and hung both loaders indefinitely.
 */
export const isCurrentRoute = (route: string) => {
  const next = new URL(route, globalThis.window.location.origin);
  return (
    next.pathname === globalThis.window.location.pathname &&
    next.search === globalThis.window.location.search
  );
};
