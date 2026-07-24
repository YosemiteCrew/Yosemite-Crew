import { clearSessionScopedStores } from '@/app/lib/resetSessionStores';

const clearOrgs = jest.fn();
const clearTeams = jest.fn();
const clearAppointments = jest.fn();
const clearAvailabilities = jest.fn();
const clearCompanions = jest.fn();
const clearDocuments = jest.fn();
const clearForms = jest.fn();
const clearInventory = jest.fn();
const clearParents = jest.fn();
const clearProfiles = jest.fn();
const clearRooms = jest.fn();
const clearServices = jest.fn();
const clearSpecialities = jest.fn();
const clearCatalog = jest.fn();
const clearInFlightGetRequests = jest.fn();

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: () => ({ clearOrgs }) },
}));
jest.mock('@/app/stores/teamStore', () => ({
  useTeamStore: { getState: () => ({ clearTeams }) },
}));
jest.mock('@/app/stores/appointmentStore', () => ({
  useAppointmentStore: { getState: () => ({ clearAppointments }) },
}));
jest.mock('@/app/stores/availabilityStore', () => ({
  useAvailabilityStore: { getState: () => ({ clearAvailabilities }) },
}));
jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: { getState: () => ({ clearCompanions }) },
}));
jest.mock('@/app/stores/documentStore', () => ({
  useOrganizationDocumentStore: { getState: () => ({ clearDocuments }) },
}));
jest.mock('@/app/stores/formsStore', () => ({
  useFormsStore: { getState: () => ({ clear: clearForms }) },
}));
jest.mock('@/app/stores/inventoryStore', () => ({
  useInventoryStore: { getState: () => ({ clearAll: clearInventory }) },
}));
jest.mock('@/app/stores/parentStore', () => ({
  useParentStore: { getState: () => ({ clearParents }) },
}));
jest.mock('@/app/stores/profileStore', () => ({
  useUserProfileStore: { getState: () => ({ clearProfiles }) },
}));
jest.mock('@/app/stores/roomStore', () => ({
  useOrganisationRoomStore: { getState: () => ({ clearRooms }) },
}));
jest.mock('@/app/stores/serviceStore', () => ({
  useServiceStore: { getState: () => ({ clearServices }) },
}));
jest.mock('@/app/stores/specialityStore', () => ({
  useSpecialityStore: { getState: () => ({ clearSpecialities }) },
}));
jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: { getState: () => ({ clearCatalog }) },
}));
jest.mock('@/app/services/axios', () => ({
  clearInFlightGetRequests: () => clearInFlightGetRequests(),
}));

const mockSessionStorage = (entries: Record<string, string>) => {
  const store = new Map(Object.entries(entries));
  const sessionStorage = {
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: jest.fn((key: string) => store.delete(key)),
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: sessionStorage,
  });
  return { store, sessionStorage };
};

describe('clearSessionScopedStores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage({});
  });

  it('clears all session-scoped stores and persisted org storage', () => {
    const removeItem = jest.fn();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { removeItem },
    });

    clearSessionScopedStores();

    expect(clearOrgs).toHaveBeenCalled();
    expect(clearTeams).toHaveBeenCalled();
    expect(clearAppointments).toHaveBeenCalled();
    expect(clearAvailabilities).toHaveBeenCalled();
    expect(clearCompanions).toHaveBeenCalled();
    expect(clearDocuments).toHaveBeenCalled();
    expect(clearForms).toHaveBeenCalled();
    expect(clearInventory).toHaveBeenCalled();
    expect(clearParents).toHaveBeenCalled();
    expect(clearProfiles).toHaveBeenCalled();
    expect(clearRooms).toHaveBeenCalled();
    expect(clearServices).toHaveBeenCalled();
    expect(clearSpecialities).toHaveBeenCalled();
    expect(clearCatalog).toHaveBeenCalled();
    expect(clearInFlightGetRequests).toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalledWith('org-store');
  });

  it('removes every org-scoped OrgGuard pass marker from session storage', () => {
    const { store } = mockSessionStorage({
      'yc_org_guard_passed:org-1': '1',
      'yc_org_guard_passed:org-2': '1',
      'yc_default_landing_applied:org-1': '1',
      'unrelated-key': 'keep-me',
    });

    clearSessionScopedStores();

    expect(store.has('yc_org_guard_passed:org-1')).toBe(false);
    expect(store.has('yc_org_guard_passed:org-2')).toBe(false);
    expect(store.has('yc_default_landing_applied:org-1')).toBe(false);
    expect(store.get('unrelated-key')).toBe('keep-me');
  });
});
