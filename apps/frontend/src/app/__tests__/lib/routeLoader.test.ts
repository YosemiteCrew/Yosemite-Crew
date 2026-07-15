import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
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
});
