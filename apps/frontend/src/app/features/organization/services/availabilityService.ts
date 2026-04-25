import {
  ApiAvailability,
  ApiDayAvailability,
  ApiOverrides,
  GetAvailabilityResponse,
} from '@/app/features/appointments/components/Availability/utils';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { Team } from '@/app/features/organization/types/team';
import { deleteData, getData, postData } from '@/app/services/axios';

export const upsertAvailability = async (
  formData: ApiAvailability,
  orgIdFromQuery: string | null
) => {
  const { primaryOrgId } = useOrgStore.getState();
  const { setAvailabilitiesForOrg } = useAvailabilityStore.getState();
  try {
    const id = orgIdFromQuery || primaryOrgId;
    if (!id) return;
    const res = await postData<GetAvailabilityResponse>(
      '/fhir/v1/availability/' + id + '/base',
      formData
    );
    const availability = res.data?.data ?? [];
    setAvailabilitiesForOrg(id, availability);
  } catch (err: unknown) {
    console.error('Failed to load orgs:', err);
    throw err;
  }
};

export const upsertTeamAvailability = async (
  team: Team,
  formData: ApiAvailability,
  orgIdFromQuery: string | null
) => {
  const { primaryOrgId } = useOrgStore.getState();
  try {
    const id = orgIdFromQuery || primaryOrgId;
    if (!id) return;
    const res = await postData<GetAvailabilityResponse>(
      '/fhir/v1/availability/' + id + '/' + team.practionerId + '/base',
      formData
    );
    const availability = res.data?.data ?? [];
    return availability;
  } catch (err: unknown) {
    console.error('Failed to load orgs:', err);
    throw err;
  }
};

const fetchAvailabilityForOrg = async (
  orgId: string,
  setAvailabilitiesForOrg: (orgId: string, data: any[]) => void
) => {
  try {
    const res = await getData<GetAvailabilityResponse>('/fhir/v1/availability/' + orgId + '/base');
    setAvailabilitiesForOrg(orgId, res.data?.data ?? []);
  } catch (err) {
    console.error(`Failed to fetch availability for orgId: ${orgId}`, err);
    setAvailabilitiesForOrg(orgId, []);
  }
};

export const loadAvailability = async (opts?: { silent?: boolean; orgId?: string }) => {
  const { orgIds } = useOrgStore.getState();
  const { startLoading, setAvailabilitiesForOrg } = useAvailabilityStore.getState();
  if (!opts?.silent) {
    startLoading();
  }

  // Single-org fast path — used during org switch to avoid fan-out
  if (opts?.orgId) {
    await fetchAvailabilityForOrg(opts.orgId, setAvailabilitiesForOrg);
    return;
  }

  try {
    if (orgIds.length === 0) {
      return;
    }
    await Promise.allSettled(
      orgIds.map((orgId) => fetchAvailabilityForOrg(orgId, setAvailabilitiesForOrg))
    );
  } catch (err: unknown) {
    console.error('Failed to load availability:', err);
    throw err;
  }
};

export const loadTeamAvailability = async (orgId: string) => {
  const { setAvailabilitiesForOrg } = useAvailabilityStore.getState();
  try {
    const res = await getData<GetAvailabilityResponse>(
      '/fhir/v1/availability/' + orgId + '/base/all'
    );
    const availability = res.data?.data ?? [];
    setAvailabilitiesForOrg(orgId, availability);
  } catch (err: unknown) {
    console.error('Failed to load team availability:', err);
    throw err;
  }
};

export const getOveridesForPrimaryDate = async (date: Date) => {
  const { primaryOrgId } = useOrgStore.getState();
  const { upsertOverideStore } = useAvailabilityStore.getState();
  try {
    if (!primaryOrgId) {
      throw new Error('No primary organization selected. Cannot load overides.');
    }
    const normalDate = date.toISOString().split('T')[0];
    const res = await getData<{ data: ApiOverrides }>(
      '/fhir/v1/availability/' + primaryOrgId + '/weekly?weekStartDate=' + normalDate
    );
    const override = res.data?.data ?? [];
    upsertOverideStore(override);
  } catch (err: unknown) {
    console.error('Failed to load overides:', err);
    throw err;
  }
};

export const createOveride = async (override: ApiOverrides) => {
  const { primaryOrgId } = useOrgStore.getState();
  const { upsertOverideStore } = useAvailabilityStore.getState();
  try {
    if (!primaryOrgId) {
      throw new Error('No primary organization selected. Cannot create overides.');
    }
    await postData('/fhir/v1/availability/' + primaryOrgId + '/weekly', override);
    upsertOverideStore(override);
  } catch (err: unknown) {
    console.error('Failed to load overides:', err);
    throw err;
  }
};

export const deleteOveride = async (override: ApiOverrides) => {
  const { removeOverride } = useAvailabilityStore.getState();
  try {
    if (!override._id || !override.dayOfWeek || !override.organisationId) {
      throw new Error('Cannot delete overides.');
    }
    await deleteData(
      '/fhir/v1/availability/' +
        override.organisationId +
        '/weekly?weekStartDate=' +
        override.dayOfWeek
    );
    removeOverride(override._id);
  } catch (err: unknown) {
    console.error('Failed to load overides:', err);
    throw err;
  }
};
