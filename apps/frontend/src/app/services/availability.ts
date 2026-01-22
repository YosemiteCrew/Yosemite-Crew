import {
  ApiAvailability,
  ApiDayAvailability,
  ApiOverrides,
  GetAvailabilityResponse,
} from "../components/Availability/utils";
import { useAvailabilityStore } from "../stores/availabilityStore";
import { useOrgStore } from "../stores/orgStore";
import { Team } from "../types/team";
import { deleteData, getData, postData } from "./axios";

export const upsertAvailability = async (
  formData: ApiAvailability,
  orgIdFromQuery: string | null,
) => {
  const { primaryOrgId } = useOrgStore.getState();
  const { setAvailabilitiesForOrg } = useAvailabilityStore.getState();
  try {
    const id = orgIdFromQuery || primaryOrgId;
    if (!id) return;
    const res = await postData<GetAvailabilityResponse>(
      "/fhir/v1/availability/" + id + "/base",
      formData,
    );
    const availability = res.data?.data ?? [];
    setAvailabilitiesForOrg(id, availability);
  } catch (err: unknown) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

export const upsertTeamAvailability = async (
  team: Team,
  formData: ApiAvailability,
  orgIdFromQuery: string | null,
) => {
  const { primaryOrgId } = useOrgStore.getState();
  try {
    const id = orgIdFromQuery || primaryOrgId;
    if (!id) return;
    const res = await postData<GetAvailabilityResponse>(
      "/fhir/v1/availablity/" + id + "/" + team.practionerId + "/base",
      formData,
    );
    const availability = res.data?.data ?? [];
    return availability;
  } catch (err: unknown) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

export const loadAvailability = async (opts?: { silent?: boolean }) => {
  const { orgIds } = useOrgStore.getState();
  const { startLoading, setAvailabilities } = useAvailabilityStore.getState();
  if (!opts?.silent) {
    startLoading();
  }
  try {
    if (orgIds.length === 0) {
      return;
    }
    const temp: ApiDayAvailability[] = [];
    await Promise.allSettled(
      orgIds.map(async (orgId) => {
        try {
          const res = await getData<GetAvailabilityResponse>(
            "/fhir/v1/availability/" + orgId + "/base",
          );
          const availability = res.data?.data ?? [];
          for (const a of availability) {
            temp.push(a);
          }
        } catch (err) {
          console.error(`Failed to fetch profile for orgId: ${orgId}`, err);
        }
      }),
    );
    setAvailabilities(temp);
  } catch (err: unknown) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

export const getOveridesForPrimaryDate = async (date: Date) => {
  const { primaryOrgId } = useOrgStore.getState();
  const { upsertOverideStore } = useAvailabilityStore.getState();
  try {
    if (!primaryOrgId) {
      throw new Error(
        "No primary organization selected. Cannot load overides.",
      );
    }
    const normalDate = date.toISOString().split("T")[0];
    const res = await getData<{ data: ApiOverrides }>(
      "/fhir/v1/availability/" +
        primaryOrgId +
        "/weekly?weekStartDate=" +
        normalDate,
    );
    const override = res.data?.data ?? [];
    upsertOverideStore(override);
  } catch (err: unknown) {
    console.error("Failed to load overides:", err);
    throw err;
  }
};

export const createOveride = async (override: ApiOverrides) => {
  const { primaryOrgId } = useOrgStore.getState();
  const { upsertOverideStore } = useAvailabilityStore.getState();
  try {
    if (!primaryOrgId) {
      throw new Error(
        "No primary organization selected. Cannot create overides.",
      );
    }
    await postData(
      "/fhir/v1/availability/" + primaryOrgId + "/weekly",
      override,
    );
    upsertOverideStore(override);
  } catch (err: unknown) {
    console.error("Failed to load overides:", err);
    throw err;
  }
};

export const deleteOveride = async (override: ApiOverrides) => {
  const { removeOverride } = useAvailabilityStore.getState();
  try {
    if (!override._id || !override.dayOfWeek || !override.organisationId) {
      throw new Error("Cannot delete overides.");
    }
    await deleteData(
      "/fhir/v1/availability/" +
        override.organisationId +
        "/weekly?weekStartDate=" +
        override.dayOfWeek,
    );
    removeOverride(override._id);
  } catch (err: unknown) {
    console.error("Failed to load overides:", err);
    throw err;
  }
};
