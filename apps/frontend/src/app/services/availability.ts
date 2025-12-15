import {
  ApiAvailability,
  ApiDayAvailability,
  GetAvailabilityResponse,
} from "../components/Availability/utils";
import { useAvailabilityStore } from "../stores/availabilityStore";
import { useOrgStore } from "../stores/orgStore";
import { getData, postData } from "./axios";

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
      "/fhir/v1/availability/" + id + "/base",
      formData
    );
    const availability = res.data?.data ?? [];
    setAvailabilitiesForOrg(id, availability);
  } catch (err: unknown) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

export const loadAvailability = async (opts?: { silent?: boolean }) => {
  const { orgIds } = useOrgStore.getState();
  const { startLoading, setAvailabilities } =
    useAvailabilityStore.getState();
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
            "/fhir/v1/availability/" + orgId + "/base"
          );
          const availability = res.data?.data ?? [];
          for (const a of availability) {
            temp.push(a);
          }
        } catch (err) {
          console.error(`Failed to fetch profile for orgId: ${orgId}`, err);
        }
      })
    );
    setAvailabilities(temp);
  } catch (err: unknown) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};
