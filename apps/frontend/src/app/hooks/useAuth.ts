import { useAuthStore } from "@/app/stores/authStore";
import { useOrgStore } from "@/app/stores/orgStore";
import { useTeamStore } from "@/app/stores/teamStore";

import { useAppointmentStore } from "@/app/stores/appointmentStore";
import { useAvailabilityStore } from "@/app/stores/availabilityStore";
import { useCompanionStore } from "@/app/stores/companionStore";
import { useOrganizationDocumentStore } from "@/app/stores/documentStore";
import { useFormsStore } from "@/app/stores/formsStore";
import { useInventoryStore } from "@/app/stores/inventoryStore";
import { useParentStore } from "@/app/stores/parentStore";
import { useUserProfileStore } from "@/app/stores/profileStore";
import { useOrganisationRoomStore } from "@/app/stores/roomStore";
import { useServiceStore } from "@/app/stores/serviceStore";
import { useSpecialityStore } from "@/app/stores/specialityStore";

export function useSignOut() {
  return { signOut: hardSignOut };
}

export async function hardSignOut() {
  try {
    await useAuthStore.getState().signout();
  } finally {
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

    try {
      localStorage.removeItem("org-store");
    } catch {
      // ignore
    }
  }
}
