import { useIntegrationStore } from '@/app/stores/integrationStore';

describe('integrationStore', () => {
  beforeEach(() => {
    useIntegrationStore.setState({
      integrationIdsByOrgId: {},
      integrationsById: {},
      status: 'idle',
      error: null,
      lastFetchedAt: null,
    });
  });

  it('sets integrations for org and replaces prior entries', () => {
    const store = useIntegrationStore.getState();
    store.setIntegrationsForOrg('org-1', [
      { _id: 'i1', organisationId: 'org-1', provider: 'MERCK_MANUALS', status: 'enabled' } as any,
    ]);
    store.setIntegrationsForOrg('org-1', [
      { _id: 'i2', organisationId: 'org-1', provider: 'IDEXX', status: 'enabled' } as any,
    ]);

    const state = useIntegrationStore.getState();
    expect(state.integrationIdsByOrgId['org-1']).toEqual(['i2']);
    expect(state.integrationsById['i1']).toBeUndefined();
    expect(state.status).toBe('loaded');
  });

  it('upserts integration and avoids duplicate ids', () => {
    const store = useIntegrationStore.getState();
    store.upsertIntegration({
      _id: 'i1',
      organisationId: 'org-1',
      provider: 'MERCK_MANUALS',
      status: 'enabled',
    } as any);
    store.upsertIntegration({
      _id: 'i1',
      organisationId: 'org-1',
      provider: 'MERCK_MANUALS',
      status: 'disabled',
    } as any);

    const state = useIntegrationStore.getState();
    expect(state.integrationIdsByOrgId['org-1']).toEqual(['i1']);
    expect(state.integrationsById['i1'].status).toBe('disabled');
  });

  it('gets integrations by org and provider (case-insensitive)', () => {
    const store = useIntegrationStore.getState();
    store.upsertIntegration({
      _id: 'i1',
      organisationId: 'org-1',
      provider: 'MERCK_MANUALS',
      status: 'enabled',
    } as any);

    expect(store.getIntegrationsByOrgId('org-1')).toHaveLength(1);
    expect(store.getIntegrationByProvider('org-1', 'MERCK_MANUALS' as any)?._id).toBe('i1');
    expect(store.getIntegrationByProvider('org-1', 'IDEXX' as any)).toBeNull();
  });

  it('clears integrations for one org and all orgs', () => {
    const store = useIntegrationStore.getState();
    store.upsertIntegration({
      _id: 'i1',
      organisationId: 'org-1',
      provider: 'MERCK_MANUALS',
      status: 'enabled',
    } as any);
    store.upsertIntegration({
      _id: 'i2',
      organisationId: 'org-2',
      provider: 'IDEXX',
      status: 'enabled',
    } as any);

    store.clearIntegrationsForOrg('org-1');
    expect(useIntegrationStore.getState().getIntegrationsByOrgId('org-1')).toHaveLength(0);
    expect(useIntegrationStore.getState().getIntegrationsByOrgId('org-2')).toHaveLength(1);

    store.clearIntegrations();
    expect(useIntegrationStore.getState().integrationIdsByOrgId).toEqual({});
    expect(useIntegrationStore.getState().integrationsById).toEqual({});
    expect(useIntegrationStore.getState().status).toBe('idle');
  });

  it('updates status lifecycle', () => {
    const store = useIntegrationStore.getState();
    store.startLoading();
    expect(useIntegrationStore.getState().status).toBe('loading');
    store.setError('boom');
    expect(useIntegrationStore.getState().status).toBe('error');
    expect(useIntegrationStore.getState().error).toBe('boom');
    store.endLoading();
    expect(useIntegrationStore.getState().status).toBe('loaded');
    expect(useIntegrationStore.getState().error).toBeNull();
  });
});
