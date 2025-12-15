import { useCallback } from "react";

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
  const signout = useAuthStore((s) => s.signout);
  const clearOrgs = useOrgStore((s) => s.clearOrgs);
  const clearTeams = useTeamStore((s) => s.clearTeams);
  const clearAppointments = useAppointmentStore((s) => s.clearAppointments);
  const clearAvailabilities = useAvailabilityStore((s) => s.clearAvailabilities);
  const clearCompanions = useCompanionStore((s) => s.clearCompanions);
  const clearDocuments = useOrganizationDocumentStore((s) => s.clearDocuments);
  const clearForms = useFormsStore((s) => s.clear);
  const clearInventory = useInventoryStore((s) => s.clearAll);
  const clearParents = useParentStore((s) => s.clearParents);
  const clearProfiles = useUserProfileStore((s) => s.clearProfiles);
  const clearRooms = useOrganisationRoomStore((s) => s.clearRooms);
  const clearServices = useServiceStore((s) => s.clearServices);
  const clearSpecialities = useSpecialityStore((s) => s.clearSpecialities);

  const signOut = useCallback(async () => {
    try {
      await signout();
    } finally {
      clearOrgs();
      clearTeams();
      clearAppointments();
      clearAvailabilities();
      clearCompanions();
      clearDocuments();
      clearForms();
      clearInventory();
      clearParents();
      clearProfiles();
      clearRooms();
      clearServices();
      clearSpecialities();
      if (typeof globalThis !== "undefined") {
        try {
          localStorage.removeItem("org-store");
        } catch {
          // ignore
        }
      }
    }
  }, [
    signout,
    clearOrgs,
    clearTeams,
    clearAppointments,
    clearAvailabilities,
    clearCompanions,
    clearDocuments,
    clearForms,
    clearInventory,
    clearParents,
    clearProfiles,
    clearRooms,
    clearServices,
    clearSpecialities,
  ]);

  return { signOut };
}
