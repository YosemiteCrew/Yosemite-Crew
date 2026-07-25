import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';

describe('useFullscreenLoaderStore', () => {
  beforeEach(() => {
    useFullscreenLoaderStore.setState({ activeSources: {} });
  });

  it('defaults to no active sources', () => {
    expect(useFullscreenLoaderStore.getState().activeSources).toEqual({});
  });

  it('adds a source on show', () => {
    useFullscreenLoaderStore.getState().show('appointments');
    expect(useFullscreenLoaderStore.getState().activeSources).toEqual({ appointments: true });
  });

  it('adds multiple sources without clobbering existing ones', () => {
    useFullscreenLoaderStore.getState().show('appointments');
    useFullscreenLoaderStore.getState().show('billing');
    expect(useFullscreenLoaderStore.getState().activeSources).toEqual({
      appointments: true,
      billing: true,
    });
  });

  it('removes a source on hide', () => {
    useFullscreenLoaderStore.getState().show('appointments');
    useFullscreenLoaderStore.getState().hide('appointments');
    expect(useFullscreenLoaderStore.getState().activeSources).toEqual({});
  });

  it('returns the same state on hide when the source is not active', () => {
    const before = useFullscreenLoaderStore.getState();
    useFullscreenLoaderStore.getState().hide('never-shown');
    const after = useFullscreenLoaderStore.getState();
    expect(after.activeSources).toEqual({});
    expect(after).toBe(before);
  });

  it('clears all active sources', () => {
    useFullscreenLoaderStore.getState().show('appointments');
    useFullscreenLoaderStore.getState().show('billing');
    useFullscreenLoaderStore.getState().clear();
    expect(useFullscreenLoaderStore.getState().activeSources).toEqual({});
  });
});
