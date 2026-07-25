import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';

describe('useRouteLoaderStore', () => {
  beforeEach(() => {
    useRouteLoaderStore.setState({ isLoading: false });
  });

  it('defaults to isLoading false', () => {
    expect(useRouteLoaderStore.getState().isLoading).toBe(false);
  });

  it('sets isLoading to true on start', () => {
    useRouteLoaderStore.getState().start();
    expect(useRouteLoaderStore.getState().isLoading).toBe(true);
  });

  it('sets isLoading to false on stop', () => {
    useRouteLoaderStore.getState().start();
    useRouteLoaderStore.getState().stop();
    expect(useRouteLoaderStore.getState().isLoading).toBe(false);
  });
});
