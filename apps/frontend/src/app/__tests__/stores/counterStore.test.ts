import { useCounterStore } from '@/app/stores/counterStore';

const baseCounter = {
  orgId: 'org-1',
  appointmentsUsed: 1,
  toolsUsed: 2,
  usersActiveCount: 1,
  usersBillableCount: 1,
};

describe('counter store', () => {
  beforeEach(() => {
    useCounterStore.setState({
      countersByOrgId: {},
      status: 'idle',
      error: null,
      lastFetchedAt: null,
    });
  });

  it('sets counters and indexes by orgId', () => {
    useCounterStore.getState().setCounters([baseCounter]);

    const state = useCounterStore.getState();
    expect(state.countersByOrgId['org-1']).toEqual(baseCounter);
    expect(state.status).toBe('loaded');
  });

  it('patches and increments counters', () => {
    useCounterStore.getState().setCounters([baseCounter]);

    useCounterStore.getState().patchCounter('org-1', { toolsUsed: 5 });
    useCounterStore.getState().increaseAppointmentsUsed('org-1', 2);

    const state = useCounterStore.getState();
    expect(state.countersByOrgId['org-1'].toolsUsed).toBe(5);
    expect(state.countersByOrgId['org-1'].appointmentsUsed).toBe(3);
  });

  it('clamps counters at zero on decrease', () => {
    useCounterStore.getState().setCounters([baseCounter]);

    useCounterStore.getState().decreaseToolsUsed('org-1', 5);
    useCounterStore.getState().decreaseUsersBillableCount('org-1', 2);

    const counter = useCounterStore.getState().countersByOrgId['org-1'];
    expect(counter.toolsUsed).toBe(0);
    expect(counter.usersBillableCount).toBe(0);
  });

  it('removes counter for org', () => {
    useCounterStore.getState().setCounters([baseCounter]);
    useCounterStore.getState().removeCounterForOrg('org-1');

    expect(useCounterStore.getState().countersByOrgId['org-1']).toBeUndefined();
  });

  it('supports setCounterForOrg add and remove', () => {
    useCounterStore.getState().setCounterForOrg('org-1', baseCounter as any);
    expect(useCounterStore.getState().getCounterByOrgId('org-1')).toEqual(baseCounter);

    useCounterStore.getState().setCounterForOrg('org-1', null);
    expect(useCounterStore.getState().getCounterByOrgId('org-1')).toBeNull();
  });

  it('ignores patch and increments when org is missing', () => {
    useCounterStore.getState().patchCounter('missing', { toolsUsed: 99 });
    useCounterStore.getState().increaseToolsUsed('missing');
    useCounterStore.getState().decreaseAppointmentsUsed('missing');
    expect(useCounterStore.getState().countersByOrgId).toEqual({});
  });

  it('skips counters with null orgId in setCounters', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    useCounterStore.getState().setCounters([null as any, { orgId: null } as any, baseCounter]);
    expect(Object.keys(useCounterStore.getState().countersByOrgId)).toEqual(['org-1']);
    warnSpy.mockRestore();
  });

  it('setCounterForOrg does nothing for empty orgId', () => {
    useCounterStore.getState().setCounterForOrg('', baseCounter as any);
    expect(useCounterStore.getState().countersByOrgId).toEqual({});
  });

  it('setCounterForOrg removes an org counter when null is passed and orgId exists', () => {
    useCounterStore.getState().setCounterForOrg('org-1', baseCounter as any);
    expect(useCounterStore.getState().countersByOrgId['org-1']).toBeDefined();

    useCounterStore.getState().setCounterForOrg('org-1', null);
    expect(useCounterStore.getState().countersByOrgId['org-1']).toBeUndefined();
  });

  it('setCounterForOrg with null for non-existent orgId still completes without error', () => {
    useCounterStore.getState().setCounterForOrg('missing-org', null);
    expect(useCounterStore.getState().countersByOrgId['missing-org']).toBeUndefined();
  });

  it('all increase/decrease ops are no-ops for missing org', () => {
    const store = useCounterStore.getState();
    store.increaseUsersActiveCount('missing');
    store.decreaseUsersActiveCount('missing');
    store.increaseUsersBillableCount('missing');
    store.decreaseUsersBillableCount('missing');
    store.increaseAppointmentsUsed('missing');
    store.decreaseToolsUsed('missing');
    expect(useCounterStore.getState().countersByOrgId).toEqual({});
  });

  it('upserts and merges counter values', () => {
    useCounterStore.getState().upsertCounter(baseCounter as any);
    useCounterStore.getState().upsertCounter({ orgId: 'org-1', toolsUsed: 9 } as any);

    const state = useCounterStore.getState();
    expect(state.countersByOrgId['org-1'].toolsUsed).toBe(9);
    expect(state.countersByOrgId['org-1'].appointmentsUsed).toBe(1);
  });

  it('upsert with invalid orgId is ignored', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    useCounterStore.getState().upsertCounter({ orgId: '' } as any);
    expect(useCounterStore.getState().countersByOrgId).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('increments and decrements all supported counters', () => {
    useCounterStore.getState().setCounters([baseCounter]);
    const store = useCounterStore.getState();

    store.increaseToolsUsed('org-1', 3);
    store.decreaseToolsUsed('org-1', 2);
    store.increaseAppointmentsUsed('org-1', 4);
    store.decreaseAppointmentsUsed('org-1', 1);
    store.increaseUsersActiveCount('org-1', 5);
    store.decreaseUsersActiveCount('org-1', 3);
    store.increaseUsersBillableCount('org-1', 2);
    store.decreaseUsersBillableCount('org-1', 1);

    const counter = useCounterStore.getState().countersByOrgId['org-1'];
    expect(counter.toolsUsed).toBe(3);
    expect(counter.appointmentsUsed).toBe(4);
    expect(counter.usersActiveCount).toBe(3);
    expect(counter.usersBillableCount).toBe(2);
  });

  it('manages loading and error lifecycle', () => {
    const store = useCounterStore.getState();
    store.startLoading();
    expect(useCounterStore.getState().status).toBe('loading');

    store.setError('boom');
    expect(useCounterStore.getState().status).toBe('error');
    expect(useCounterStore.getState().error).toBe('boom');

    store.endLoading();
    expect(useCounterStore.getState().status).toBe('loaded');
    expect(useCounterStore.getState().error).toBeNull();
  });

  it('clears counters and resets metadata', () => {
    useCounterStore.getState().setCounters([baseCounter]);
    useCounterStore.getState().clearCounters();
    const state = useCounterStore.getState();
    expect(state.countersByOrgId).toEqual({});
    expect(state.status).toBe('idle');
    expect(state.lastFetchedAt).toBeNull();
  });
});
