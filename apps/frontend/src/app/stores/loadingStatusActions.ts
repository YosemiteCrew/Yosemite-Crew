export type LoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type LoadingStatusState = {
  status: LoadingStatus;
  error: string | null;
  lastFetchedAt: string | null;
};

export type LoadingStatusActions = {
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

type SetLoadingStatusState = (updater: () => Partial<LoadingStatusState>) => void;

/**
 * Shared `startLoading`/`endLoading`/`setError` actions spread into the
 * org-scoped stores (appointmentStore, integrationStore) so their loading
 * lifecycle stays identical.
 */
export const loadingStatusActions = (set: SetLoadingStatusState): LoadingStatusActions => ({
  startLoading: () => set(() => ({ status: 'loading', error: null })),

  endLoading: () =>
    set(() => ({
      status: 'loaded',
      error: null,
      lastFetchedAt: new Date().toISOString(),
    })),

  setError: (message) => set(() => ({ status: 'error', error: message })),
});
