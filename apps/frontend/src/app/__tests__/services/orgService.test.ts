import {
  createOrg,
  deleteOrg,
  loadOrgs,
  updateOrg,
} from '@/app/features/organization/services/orgService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useCounterStore } from '@/app/stores/counterStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useServiceStore } from '@/app/stores/serviceStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useTeamStore } from '@/app/stores/teamStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { getData, postData, putData, deleteData } from '@/app/services/axios';
import axios from 'axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  putData: jest.fn(),
  deleteData: jest.fn(),
}));

jest.mock('axios', () => ({
  isAxiosError: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/counterStore', () => ({
  useCounterStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/subscriptionStore', () => ({
  useSubscriptionStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/availabilityStore', () => ({
  useAvailabilityStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/documentStore', () => ({
  useOrganizationDocumentStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/roomStore', () => ({
  useOrganisationRoomStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/serviceStore', () => ({
  useServiceStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/specialityStore', () => ({
  useSpecialityStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/teamStore', () => ({
  useTeamStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/profileStore', () => ({
  useUserProfileStore: { getState: jest.fn() },
}));

jest.mock('@yosemite-crew/types', () => ({
  toOrganizationResponseDTO: (data: any) => data,
  fromOrganizationRequestDTO: (data: any) => data,
  fromUserOrganizationRequestDTO: (data: any) => data,
}));

describe('orgService', () => {
  const orgState = {
    startLoading: jest.fn(),
    setOrgs: jest.fn(),
    setError: jest.fn(),
    setUserOrgMappings: jest.fn(),
    upsertOrg: jest.fn(),
    setPrimaryOrg: jest.fn(),
    upsertUserOrgMapping: jest.fn(),
    updateOrg: jest.fn(),
    removeOrg: jest.fn(),
    primaryOrgId: 'org-1',
  };

  const authState = {
    user: { getUsername: jest.fn(() => 'user-1') },
    attributes: { sub: 'practitioner-1' },
  };

  const counterState = { setCounters: jest.fn() };
  const subscriptionState = { setSubscriptions: jest.fn() };

  const clearMocks = {
    clearCompanionsForOrg: jest.fn(),
    clearAvailabilitiesForOrg: jest.fn(),
    clearDocumentsForOrg: jest.fn(),
    clearRoomsForOrg: jest.fn(),
    clearServicesForOrg: jest.fn(),
    clearSpecialitiesForOrg: jest.fn(),
    clearTeamsForOrg: jest.fn(),
    clearProfileForOrg: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useOrgStore.getState as jest.Mock).mockReturnValue(orgState);
    (useAuthStore.getState as jest.Mock).mockReturnValue(authState);
    (useCounterStore.getState as jest.Mock).mockReturnValue(counterState);
    (useSubscriptionStore.getState as jest.Mock).mockReturnValue(subscriptionState);
    (useCompanionStore.getState as jest.Mock).mockReturnValue({
      clearCompanionsForOrg: clearMocks.clearCompanionsForOrg,
    });
    (useAvailabilityStore.getState as jest.Mock).mockReturnValue({
      clearAvailabilitiesForOrg: clearMocks.clearAvailabilitiesForOrg,
    });
    (useOrganizationDocumentStore.getState as jest.Mock).mockReturnValue({
      clearDocumentsForOrg: clearMocks.clearDocumentsForOrg,
    });
    (useOrganisationRoomStore.getState as jest.Mock).mockReturnValue({
      clearRoomsForOrg: clearMocks.clearRoomsForOrg,
    });
    (useServiceStore.getState as jest.Mock).mockReturnValue({
      clearServicesForOrg: clearMocks.clearServicesForOrg,
    });
    (useSpecialityStore.getState as jest.Mock).mockReturnValue({
      clearSpecialitiesForOrg: clearMocks.clearSpecialitiesForOrg,
    });
    (useTeamStore.getState as jest.Mock).mockReturnValue({
      clearTeamsForOrg: clearMocks.clearTeamsForOrg,
    });
    (useUserProfileStore.getState as jest.Mock).mockReturnValue({
      clearProfileForOrg: clearMocks.clearProfileForOrg,
    });
  });

  it('loads organizations and updates stores', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: [
        {
          mapping: { organisationReference: 'org-1' },
          organization: { _id: 'org-1', name: 'Org' },
          orgUsage: { orgId: 'org-1' },
          orgBilling: { orgId: 'org-1' },
        },
      ],
    });

    await loadOrgs();

    expect(orgState.startLoading).toHaveBeenCalled();
    expect(orgState.setOrgs).toHaveBeenCalled();
    expect(orgState.setUserOrgMappings).toHaveBeenCalled();
    expect(counterState.setCounters).toHaveBeenCalled();
    expect(subscriptionState.setSubscriptions).toHaveBeenCalled();
  });

  it('creates an organization and sets primary org', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: { name: 'Org' } });

    const newOrgId = await createOrg({ name: 'Org' } as any);

    expect(postData).toHaveBeenCalled();
    expect(orgState.upsertOrg).toHaveBeenCalled();
    expect(orgState.setPrimaryOrg).toHaveBeenCalled();
    expect(orgState.upsertUserOrgMapping).toHaveBeenCalled();
    expect(newOrgId).toBe('Org');
  });

  it('updates an organization', async () => {
    (putData as jest.Mock).mockResolvedValue({ data: { name: 'Updated' } });

    await updateOrg({ _id: 'org-1', name: 'Updated' } as any);

    expect(putData).toHaveBeenCalledWith('/fhir/v1/organization/org-1', expect.any(Object));
    expect(orgState.updateOrg).toHaveBeenCalledWith('org-1', {
      name: 'Updated',
    });
  });

  it('does not update without org id', async () => {
    await updateOrg({ name: 'Missing' } as any);

    expect(orgState.setError).toHaveBeenCalled();
    expect(putData).not.toHaveBeenCalled();
  });

  it('deletes an organization and clears dependent stores', async () => {
    (deleteData as jest.Mock).mockResolvedValue({});

    await deleteOrg();

    expect(deleteData).toHaveBeenCalledWith('/fhir/v1/organization/org-1');
    expect(clearMocks.clearCompanionsForOrg).toHaveBeenCalledWith('org-1');
    expect(clearMocks.clearAvailabilitiesForOrg).toHaveBeenCalledWith('org-1');
    expect(clearMocks.clearDocumentsForOrg).toHaveBeenCalledWith('org-1');
    expect(clearMocks.clearRoomsForOrg).toHaveBeenCalledWith('org-1');
    expect(clearMocks.clearServicesForOrg).toHaveBeenCalledWith('org-1');
    expect(clearMocks.clearSpecialitiesForOrg).toHaveBeenCalledWith('org-1');
    expect(clearMocks.clearTeamsForOrg).toHaveBeenCalledWith('org-1');
    expect(clearMocks.clearProfileForOrg).toHaveBeenCalledWith('org-1');
    expect(orgState.removeOrg).toHaveBeenCalledWith('org-1');
  });

  it('loadOrgs sets 403 error message on axios 403', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const axiosError = Object.assign(new Error('Forbidden'), {
      response: { status: 403, data: {} },
    });
    (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
    (getData as jest.Mock).mockRejectedValue(axiosError);

    await expect(loadOrgs()).rejects.toThrow();
    expect(orgState.setError).toHaveBeenCalledWith(
      "You don't have permission to fetch organizations."
    );
    consoleSpy.mockRestore();
    (axios.isAxiosError as unknown as jest.Mock).mockReset();
  });

  it('loadOrgs sets 404 error message on axios 404', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const axiosError = Object.assign(new Error('Not Found'), {
      response: { status: 404, data: {} },
    });
    (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
    (getData as jest.Mock).mockRejectedValue(axiosError);

    await expect(loadOrgs()).rejects.toThrow();
    expect(orgState.setError).toHaveBeenCalledWith(
      'Organization service not found. Please contact support.'
    );
    consoleSpy.mockRestore();
    (axios.isAxiosError as unknown as jest.Mock).mockReset();
  });

  it('loadOrgs sets generic error on non-axios error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
    (getData as jest.Mock).mockRejectedValue(new Error('unknown'));

    await expect(loadOrgs()).rejects.toThrow();
    expect(orgState.setError).toHaveBeenCalledWith('Unexpected error while fetching organization');
    consoleSpy.mockRestore();
    (axios.isAxiosError as unknown as jest.Mock).mockReset();
  });

  it('loadOrgs silent mode does not call setError or startLoading on error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
    (getData as jest.Mock).mockRejectedValue(new Error('unknown'));

    await expect(loadOrgs({ silent: true })).rejects.toThrow();
    expect(orgState.setError).not.toHaveBeenCalled();
    expect(orgState.startLoading).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    (axios.isAxiosError as unknown as jest.Mock).mockReset();
  });

  it('createOrg sets 403 error on axios 403', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const axiosError = Object.assign(new Error('Forbidden'), {
      response: { status: 403, data: {} },
    });
    (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
    (postData as jest.Mock).mockRejectedValue(axiosError);

    await expect(createOrg({ name: 'Org' } as any)).rejects.toThrow();
    expect(orgState.setError).toHaveBeenCalledWith(
      "You don't have permission to create organizations."
    );
    consoleSpy.mockRestore();
    (axios.isAxiosError as unknown as jest.Mock).mockReset();
  });

  it('createOrg sets 404 error on axios 404', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const axiosError = Object.assign(new Error('Not Found'), {
      response: { status: 404, data: {} },
    });
    (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
    (postData as jest.Mock).mockRejectedValue(axiosError);

    await expect(createOrg({ name: 'Org' } as any)).rejects.toThrow();
    expect(orgState.setError).toHaveBeenCalledWith(
      'Organization service not found. Please contact support.'
    );
    consoleSpy.mockRestore();
    (axios.isAxiosError as unknown as jest.Mock).mockReset();
  });

  it('updateOrg sets 403 error on axios 403', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const axiosError = Object.assign(new Error('Forbidden'), {
      response: { status: 403, data: {} },
    });
    (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
    (putData as jest.Mock).mockRejectedValue(axiosError);

    await expect(updateOrg({ _id: 'org-1', name: 'X' } as any)).rejects.toThrow();
    expect(orgState.setError).toHaveBeenCalledWith(
      "You don't have permission to update organizations."
    );
    consoleSpy.mockRestore();
    (axios.isAxiosError as unknown as jest.Mock).mockReset();
  });
});
