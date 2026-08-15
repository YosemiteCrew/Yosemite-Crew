import { loadingStatusActions, type LoadingStatusState } from '@/app/stores/loadingStatusActions';

describe('loadingStatusActions', () => {
  const buildActions = () => {
    const updates: Partial<LoadingStatusState>[] = [];
    const set = (updater: () => Partial<LoadingStatusState>) => {
      updates.push(updater());
    };
    return { updates, actions: loadingStatusActions(set) };
  };

  it('startLoading marks the store loading and clears the error', () => {
    const { updates, actions } = buildActions();
    actions.startLoading();
    expect(updates).toEqual([{ status: 'loading', error: null }]);
  });

  it('endLoading marks the store loaded and stamps lastFetchedAt', () => {
    const { updates, actions } = buildActions();
    const before = Date.now();
    actions.endLoading();
    const [update] = updates;
    expect(update.status).toBe('loaded');
    expect(update.error).toBeNull();
    const stamp = Date.parse(update.lastFetchedAt as string);
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(Date.now());
  });

  it('setError records the message with an error status', () => {
    const { updates, actions } = buildActions();
    actions.setError('boom');
    expect(updates).toEqual([{ status: 'error', error: 'boom' }]);
  });
});
