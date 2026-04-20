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

describe('clearSessionScopedStores', () => {
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
    expect(removeItem).toHaveBeenCalledWith('org-store');
  });
});
