import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useServiceStore } from '@/app/stores/serviceStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useTeamStore } from '@/app/stores/teamStore';

const ORG_STORE_STORAGE_KEY = 'org-store';

export const clearSessionScopedStores = () => {
  useOrgStore.getState().clearOrgs();
  useTeamStore.getState().clearTeams();
  useAppointmentStore.getState().clearAppointments();
  useAvailabilityStore.getState().clearAvailabilities();
  useCompanionStore.getState().clearCompanions();
  useOrganizationDocumentStore.getState().clearDocuments();
  useFormsStore.getState().clear();
  useInventoryStore.getState().clearAll();
  useParentStore.getState().clearParents();
  useUserProfileStore.getState().clearProfiles();
  useOrganisationRoomStore.getState().clearRooms();
  useServiceStore.getState().clearServices();
  useSpecialityStore.getState().clearSpecialities();

  if (typeof globalThis === 'undefined') {
    return;
  }

  try {
    globalThis.localStorage?.removeItem(ORG_STORE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
};
