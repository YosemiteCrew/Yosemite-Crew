import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useCounterStore } from '@/app/stores/counterStore';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useServiceStore } from '@/app/stores/serviceStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import { removeStorageItem, removeStorageItemsByPrefix } from '@/app/lib/browserStorage';
import { clearInFlightGetRequests } from '@/app/services/axios';
import { clearInFlightAuditRequests } from '@/app/features/audit/services/auditService';

const ORG_STORE_STORAGE_KEY = 'org-store';
// Written per org by OrgGuard; without this the next user in the same tab
// inherits the previous user's "already passed" fast path.
const ORG_GUARD_PASSED_KEY_PREFIX = 'yc_org_guard_passed:';
const DEFAULT_LANDING_APPLIED_KEY_PREFIX = 'yc_default_landing_applied:';

export const clearSessionScopedStores = () => {
  useOrgStore.getState().clearOrgs();
  useTeamStore.getState().clearTeams();
  useAppointmentStore.getState().clearAppointments();
  useAvailabilityStore.getState().clearAvailabilities();
  useCompanionStore.getState().clearCompanions();
  useOrganizationDocumentStore.getState().clearDocuments();
  useFormsStore.getState().clear();
  useInventoryStore.getState().clearAll();
  useInvoiceStore.getState().clearInvoices();
  useIntegrationStore.getState().clearIntegrations();
  useSubscriptionStore.getState().clearSubscriptions();
  useTaskStore.getState().clearTasks();
  useCounterStore.getState().clearCounters();
  useParentStore.getState().clearParents();
  useUserProfileStore.getState().clearProfiles();
  useOrganisationRoomStore.getState().clearRooms();
  useServiceStore.getState().clearServices();
  useSpecialityStore.getState().clearSpecialities();
  useRevampCatalogStore.getState().clearCatalog();
  clearInFlightGetRequests();
  clearInFlightAuditRequests();
  removeStorageItem('local', ORG_STORE_STORAGE_KEY);
  removeStorageItemsByPrefix('session', ORG_GUARD_PASSED_KEY_PREFIX);
  removeStorageItemsByPrefix('session', DEFAULT_LANDING_APPLIED_KEY_PREFIX);
};
