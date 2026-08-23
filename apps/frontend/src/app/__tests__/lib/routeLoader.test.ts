import { isCurrentRoute, startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';

describe('routeLoader', () => {
  beforeEach(() => {
    useRouteLoaderStore.setState({ isLoading: false });
  });

  it('starts the route loader store', () => {
    startRouteLoader();
    expect(useRouteLoaderStore.getState().isLoading).toBe(true);
  });

  it('stops the route loader store', () => {
    useRouteLoaderStore.getState().start();
    stopRouteLoader();
    expect(useRouteLoaderStore.getState().isLoading).toBe(false);
  });

  // Callers use this to decide whether they must release the org-switch loader
  // themselves: RouteLoaderOverlay only releases it when the pathname or query
  // changes, so a push to the route already displayed releases nothing.
  describe('isCurrentRoute', () => {
    // jsdom refuses to have window.location redefined, so drive the URL through
    // the history API - which is also closer to how the app actually navigates.
    const setLocation = (url: string) => {
      globalThis.window.history.pushState({}, '', url);
    };

    afterEach(() => {
      globalThis.window.history.pushState({}, '', '/');
    });

    it('is true for the same pathname with no query on either side', () => {
      setLocation('/organizations');
      expect(isCurrentRoute('/organizations')).toBe(true);
    });

    it('is false for a different pathname', () => {
      setLocation('/organizations');
      expect(isCurrentRoute('/appointments')).toBe(false);
    });

    // The query matters: /create-org?orgId=a and ?orgId=b are different
    // destinations, and treating them as the same route would release the
    // loader on a navigation that really is about to happen.
    it('is false when only the query differs', () => {
      setLocation('/create-org?orgId=a');
      expect(isCurrentRoute('/create-org?orgId=b')).toBe(false);
    });

    it('is true when pathname and query both match', () => {
      setLocation('/create-org?orgId=a');
      expect(isCurrentRoute('/create-org?orgId=a')).toBe(true);
    });

    it('resolves a relative route against the current origin', () => {
      setLocation('/organizations');
      expect(isCurrentRoute(`${globalThis.window.location.origin}/organizations`)).toBe(true);
    });
  });
});
