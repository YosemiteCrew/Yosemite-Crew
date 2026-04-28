import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';

// Helper to create mock availability objects
const createMockAvailability = (id: string, orgId: string): ApiDayAvailability =>
  ({
    _id: id,
    organisationId: orgId,
    // Removed 'intervals: []' from the mock object to avoid casting issues,
    // relying on the component logic to handle the full object structure.
  }) as unknown as ApiDayAvailability;

const createMockUserAvailability = (
  id: string,
  orgId: string,
  userId: string
): ApiDayAvailability =>
  ({
    ...createMockAvailability(id, orgId),
    userId,
  }) as unknown as ApiDayAvailability;

describe('availabilityStore', () => {
  // Reset store before each test to ensure isolation
  beforeEach(() => {
    useAvailabilityStore.setState({
      availabilitiesById: {},
      availabilityIdsByOrgId: {},
      overridesById: {},
      overrideIdsByOrgId: {},
      status: 'idle',
      error: null,
      lastFetchedAt: null,
    });
  });

  // --- 1. Basic Status Actions ---

  it('should handle loading state', () => {
    const { startLoading } = useAvailabilityStore.getState();
    startLoading();

    const state = useAvailabilityStore.getState();
    expect(state.status).toBe('loading');
    expect(state.error).toBeNull();
  });

  it('should handle error state', () => {
    const { setError } = useAvailabilityStore.getState();
    setError('Something went wrong');

    const state = useAvailabilityStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Something went wrong');
  });

  it('should handle end loading state', () => {
    const { endLoading } = useAvailabilityStore.getState();
    endLoading();

    const state = useAvailabilityStore.getState();
    expect(state.status).toBe('loaded');
    expect(state.error).toBeNull();
    expect(state.lastFetchedAt).not.toBeNull();
  });

  it('should clear all availabilities', () => {
    const { setAvailabilities, clearAvailabilities } = useAvailabilityStore.getState();
    const item = createMockAvailability('av1', 'org1');

    // Setup initial state
    setAvailabilities([item]);
    expect(useAvailabilityStore.getState().availabilitiesById['av1']).toBeDefined();

    // Clear
    clearAvailabilities();

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById).toEqual({});
    expect(state.availabilityIdsByOrgId).toEqual({});
    expect(state.status).toBe('idle');
    expect(state.lastFetchedAt).toBeNull();
  });

  it('clears an org with no availability ids without affecting other orgs', () => {
    useAvailabilityStore.setState({
      availabilitiesById: { av2: createMockAvailability('av2', 'org2') },
      availabilityIdsByOrgId: { org1: [], org2: ['av2'] },
      overridesById: {},
      overrideIdsByOrgId: {},
      status: 'idle',
      error: null,
      lastFetchedAt: null,
    });

    useAvailabilityStore.getState().clearAvailabilitiesForOrg('org1');

    const state = useAvailabilityStore.getState();
    expect(state.availabilityIdsByOrgId.org1).toBeUndefined();
    expect(state.availabilitiesById.av2).toBeDefined();
  });

  // --- 2. Set Availabilities (Bulk Load) ---

  it('should set availabilities and map them correctly', () => {
    const { setAvailabilities } = useAvailabilityStore.getState();
    const item1 = createMockAvailability('av1', 'org1');
    const item2 = createMockAvailability('av2', 'org1');
    const item3 = createMockAvailability('av3', 'org2');

    setAvailabilities([item1, item2, item3]);

    const state = useAvailabilityStore.getState();

    // Check ID Map
    expect(state.availabilitiesById['av1']).toEqual(item1);
    expect(state.availabilitiesById['av2']).toEqual(item2);
    expect(state.availabilitiesById['av3']).toEqual(item3);

    // Check Org Indexes
    expect(state.availabilityIdsByOrgId['org1']).toEqual(['av1', 'av2']);
    expect(state.availabilityIdsByOrgId['org2']).toEqual(['av3']);

    expect(state.status).toBe('loaded');
  });

  // --- 3. Set Availabilities For Specific Org ---

  it('should replace availabilities for a specific org', () => {
    const { setAvailabilities, setAvailabilitiesForOrg } = useAvailabilityStore.getState();

    // Initial state: Org1 has av1, Org2 has av2
    const av1 = createMockAvailability('av1', 'org1');
    const av2 = createMockAvailability('av2', 'org2');
    setAvailabilities([av1, av2]);

    // Update Org1: Replace av1 with av3
    const av3 = createMockAvailability('av3', 'org1');
    setAvailabilitiesForOrg('org1', [av3]);

    const state = useAvailabilityStore.getState();

    // av1 should be deleted from map
    expect(state.availabilitiesById['av1']).toBeUndefined();
    // av2 (different org) should remain
    expect(state.availabilitiesById['av2']).toBeDefined();
    // av3 should be added
    expect(state.availabilitiesById['av3']).toEqual(av3);

    // Indexes
    expect(state.availabilityIdsByOrgId['org1']).toEqual(['av3']);
    expect(state.availabilityIdsByOrgId['org2']).toEqual(['av2']);
  });

  it('should handle empty existing ids safely in setAvailabilitiesForOrg', () => {
    const { setAvailabilitiesForOrg } = useAvailabilityStore.getState();
    const av1 = createMockAvailability('av1', 'org1');

    // No prior state
    setAvailabilitiesForOrg('org1', [av1]);

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById['av1']).toBeDefined();
    expect(state.availabilityIdsByOrgId['org1']).toEqual(['av1']);
  });

  it('should preserve user-specific rows when replacing base availabilities for an org', () => {
    const { setAvailabilitiesForOrg, setBaseAvailabilitiesForOrg } =
      useAvailabilityStore.getState();
    const baseOld = createMockAvailability('base-old', 'org1');
    const userSpecific = createMockUserAvailability('user-1-mon', 'org1', 'practitioner-1');
    const otherOrg = createMockAvailability('other-org', 'org2');

    setAvailabilitiesForOrg('org1', [baseOld, userSpecific]);
    setAvailabilitiesForOrg('org2', [otherOrg]);

    const baseNew = createMockAvailability('base-new', 'org1');
    setBaseAvailabilitiesForOrg('org1', [baseNew]);

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById['base-old']).toBeUndefined();
    expect(state.availabilitiesById['base-new']).toEqual(baseNew);
    expect(state.availabilitiesById['user-1-mon']).toEqual(userSpecific);
    expect(state.availabilitiesById['other-org']).toEqual(otherOrg);
    expect(state.availabilityIdsByOrgId['org1']).toEqual(['base-new', 'user-1-mon']);
    expect(state.availabilityIdsByOrgId['org2']).toEqual(['other-org']);
  });

  it('deduplicates ids when a base row id also appears in the incoming user items', () => {
    const { setAvailabilitiesForOrg, setUserAvailabilitiesForOrg } =
      useAvailabilityStore.getState();
    const shared = createMockAvailability('shared-id', 'org1');
    const orgBase = createMockAvailability('base-only', 'org1');
    const userOld = createMockUserAvailability('user-old', 'org1', 'user-1');

    setAvailabilitiesForOrg('org1', [shared, orgBase, userOld]);

    // incoming items include the shared id (same _id, now also marked as user-specific)
    const userNew = createMockUserAvailability('user-new', 'org1', 'user-1');
    const sharedAsUser = createMockUserAvailability('shared-id', 'org1', 'user-1');
    setUserAvailabilitiesForOrg('org1', 'user-1', [sharedAsUser, userNew]);

    const state = useAvailabilityStore.getState();
    const ids = state.availabilityIdsByOrgId['org1'];
    // 'shared-id' must appear exactly once
    expect(ids.filter((id) => id === 'shared-id')).toHaveLength(1);
    expect(ids).toContain('base-only');
    expect(ids).toContain('user-new');
    expect(ids).not.toContain('user-old');
  });

  it('should replace only one user availability set for an org', () => {
    const { setAvailabilitiesForOrg, setUserAvailabilitiesForOrg } =
      useAvailabilityStore.getState();
    const userOld = createMockUserAvailability('user-old', 'org1', 'Practitioner/user-1');
    const userOther = createMockUserAvailability('user-other', 'org1', 'user-2');
    const orgDefault = createMockAvailability('org-default', 'org1');

    setAvailabilitiesForOrg('org1', [orgDefault, userOld, userOther]);

    const userNew = createMockUserAvailability('user-new', 'org1', 'user-1');
    setUserAvailabilitiesForOrg('org1', 'Practitioner/user-1', [userNew]);

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById['user-old']).toBeUndefined();
    expect(state.availabilitiesById['org-default']).toEqual(orgDefault);
    expect(state.availabilitiesById['user-other']).toEqual(userOther);
    expect(state.availabilitiesById['user-new']).toEqual(userNew);
    expect(state.availabilityIdsByOrgId.org1).toEqual(['org-default', 'user-other', 'user-new']);
  });

  // --- 4. Upsert (Add or Update) ---

  it('should add a new availability via upsert', () => {
    const { upsertAvailabilityStore } = useAvailabilityStore.getState();
    const av1 = createMockAvailability('av1', 'org1');

    upsertAvailabilityStore(av1);

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById['av1']).toEqual(av1);
    expect(state.availabilityIdsByOrgId['org1']).toEqual(['av1']);
  });

  it('should update an existing availability via upsert', () => {
    const { upsertAvailabilityStore } = useAvailabilityStore.getState();
    const av1 = createMockAvailability('av1', 'org1');

    // Initial Add
    upsertAvailabilityStore(av1);

    // Update: Modify a property that should persist the update (using organisationId for this check)
    const newOrgIdForUpdate = 'org1-updated';
    const av1Updated = { ...av1, organisationId: newOrgIdForUpdate } as ApiDayAvailability;

    upsertAvailabilityStore(av1Updated);

    const state = useAvailabilityStore.getState();
    // Check if the property was updated
    expect(state.availabilitiesById['av1'].organisationId).toBe(newOrgIdForUpdate);
    // Ensure ID isn't duplicated in index
    expect(state.availabilityIdsByOrgId['org1']).toHaveLength(1);
    expect(state.availabilityIdsByOrgId['org1']).toEqual(['av1']);
  });

  it('should handle adding to existing index via upsert', () => {
    const { upsertAvailabilityStore } = useAvailabilityStore.getState();
    const av1 = createMockAvailability('av1', 'org1');
    const av2 = createMockAvailability('av2', 'org1'); // Same org

    upsertAvailabilityStore(av1);
    upsertAvailabilityStore(av2);

    const state = useAvailabilityStore.getState();
    expect(state.availabilityIdsByOrgId['org1']).toEqual(['av1', 'av2']);
  });

  it('merges availabilities without duplicating ids', () => {
    const store = useAvailabilityStore.getState();
    const av1 = createMockAvailability('av1', 'org1');
    const av2 = createMockAvailability('av2', 'org1');

    store.setAvailabilities([av1]);
    store.mergeAvailabilities([av1, av2]);

    const state = useAvailabilityStore.getState();
    expect(state.availabilityIdsByOrgId['org1']).toEqual(['av1', 'av2']);
    expect(state.availabilitiesById['av2']).toEqual(av2);
  });

  // --- 5. Remove Availability ---

  it('should remove an availability and update index', () => {
    const { setAvailabilities, removeAvailability } = useAvailabilityStore.getState();
    const av1 = createMockAvailability('av1', 'org1');
    setAvailabilities([av1]);

    removeAvailability('av1');

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById['av1']).toBeUndefined();
    expect(state.availabilityIdsByOrgId['org1']).toEqual([]);
  });

  it('should do nothing if removing non-existent availability', () => {
    const { removeAvailability } = useAvailabilityStore.getState();

    // Should not crash or change state
    removeAvailability('ghost-id');

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById).toEqual({});
  });

  it('should handle removal when org index is undefined (edge case safety)', () => {
    // Manually set state with an ID in map but no index (inconsistent state)
    useAvailabilityStore.setState({
      availabilitiesById: { av1: createMockAvailability('av1', 'org1') },
      availabilityIdsByOrgId: {}, // Empty index
    });

    const { removeAvailability } = useAvailabilityStore.getState();
    removeAvailability('av1');

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById['av1']).toBeUndefined();
    // Should result in empty array for that org key
    expect(state.availabilityIdsByOrgId['org1']).toEqual([]);
  });

  // --- 6. Selectors ---

  it('should retrieve availabilities by org ID', () => {
    const { setAvailabilities, getAvailabilitiesByOrgId } = useAvailabilityStore.getState();
    const av1 = createMockAvailability('av1', 'org1');
    const av2 = createMockAvailability('av2', 'org1');
    const av3 = createMockAvailability('av3', 'org2');

    setAvailabilities([av1, av2, av3]);

    const org1Items = getAvailabilitiesByOrgId('org1');
    expect(org1Items).toHaveLength(2);
    expect(org1Items).toEqual([av1, av2]);

    const org2Items = getAvailabilitiesByOrgId('org2');
    expect(org2Items).toHaveLength(1);
    expect(org2Items).toEqual([av3]);

    const emptyItems = getAvailabilitiesByOrgId('org-none');
    expect(emptyItems).toEqual([]);
  });

  it('should filter out undefined items in selector (safety check)', () => {
    useAvailabilityStore.setState({
      availabilitiesById: {},
      availabilityIdsByOrgId: { org1: ['missing-id'] },
    });

    const { getAvailabilitiesByOrgId } = useAvailabilityStore.getState();
    const items = getAvailabilitiesByOrgId('org1');

    expect(items).toEqual([]);
  });

  // --- 7. Override CRUD/indexing ---
  it('sets overrides and builds org index', () => {
    const { setOverrides } = useAvailabilityStore.getState();
    setOverrides([
      { _id: 'ov1', organisationId: 'org1' } as any,
      { _id: 'ov2', organisationId: 'org1' } as any,
      { _id: 'ov3', organisationId: 'org2' } as any,
    ]);
    const state = useAvailabilityStore.getState();
    expect(state.overridesById['ov1']).toBeDefined();
    expect(state.overrideIdsByOrgId['org1']).toEqual(['ov1', 'ov2']);
    expect(state.overrideIdsByOrgId['org2']).toEqual(['ov3']);
  });

  it('replaces overrides for one org', () => {
    const store = useAvailabilityStore.getState();
    store.setOverrides([
      { _id: 'ov1', organisationId: 'org1' } as any,
      { _id: 'ov2', organisationId: 'org2' } as any,
    ]);
    store.setOverridesForOrg('org1', [{ _id: 'ov3', organisationId: 'org1' } as any]);
    const state = useAvailabilityStore.getState();
    expect(state.overridesById['ov1']).toBeUndefined();
    expect(state.overridesById['ov2']).toBeDefined();
    expect(state.overridesById['ov3']).toBeDefined();
    expect(state.overrideIdsByOrgId['org1']).toEqual(['ov3']);
  });

  it('sets overrides for an org with no previous ids', () => {
    useAvailabilityStore
      .getState()
      .setOverridesForOrg('org9', [{ _id: 'ov9', organisationId: 'org9' } as any]);

    const state = useAvailabilityStore.getState();
    expect(state.overridesById['ov9']).toBeDefined();
    expect(state.overrideIdsByOrgId['org9']).toEqual(['ov9']);
  });

  it('upserts and removes overrides', () => {
    const store = useAvailabilityStore.getState();
    store.upsertOverideStore({ _id: 'ov1', organisationId: 'org1', dayOfWeek: 'Monday' } as any);
    store.upsertOverideStore({ _id: 'ov1', organisationId: 'org1', dayOfWeek: 'Tuesday' } as any);
    expect(useAvailabilityStore.getState().overridesById['ov1'].dayOfWeek).toBe('Tuesday');
    expect(useAvailabilityStore.getState().overrideIdsByOrgId['org1']).toEqual(['ov1']);

    store.removeOverride('ov1');
    expect(useAvailabilityStore.getState().overridesById['ov1']).toBeUndefined();
    expect(useAvailabilityStore.getState().overrideIdsByOrgId['org1']).toEqual([]);
  });

  it('ignore removeOverride for unknown id', () => {
    const snapshot = JSON.stringify(useAvailabilityStore.getState());
    useAvailabilityStore.getState().removeOverride('missing');
    expect(JSON.stringify(useAvailabilityStore.getState())).toEqual(snapshot);
  });

  it('handles removeOverride when org index is missing', () => {
    useAvailabilityStore.setState({
      availabilitiesById: {},
      availabilityIdsByOrgId: {},
      overridesById: { ov1: { _id: 'ov1', organisationId: 'org1' } as any },
      overrideIdsByOrgId: {},
      status: 'idle',
      error: null,
      lastFetchedAt: null,
    });

    useAvailabilityStore.getState().removeOverride('ov1');

    const state = useAvailabilityStore.getState();
    expect(state.overridesById['ov1']).toBeUndefined();
    expect(state.overrideIdsByOrgId['org1']).toEqual([]);
  });
});
