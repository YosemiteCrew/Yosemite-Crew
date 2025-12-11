import axios from "axios";
import { getData } from "@/app/services/axios";
import { useOrgStore } from "@/app/stores/orgStore";
import { Service } from "@yosemite-crew/types";

export const loadServicesForOrg = async (): Promise<Service[]> => {
  const orgId = useOrgStore.getState().primaryOrgId;
  if (!orgId) {
    console.warn("No primary organisation selected. Skipping service fetch.");
    return [];
  }

  try {
    try {
      const res = await getData<Service[]>(
        `/fhir/v1/service/organisaion/${orgId}`
      );
      return res.data ?? [];
    } catch (primaryError) {
      if (axios.isAxiosError(primaryError)) {
        // retry with corrected spelling if the first path fails
        const res = await getData<Service[]>(
          `/fhir/v1/service/organisation/${orgId}`
        );
        return res.data ?? [];
      }
      throw primaryError;
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        "Failed to load services:",
        err.response?.data?.message ?? err.message
      );
    } else {
      console.error("Failed to load services:", err);
    }
    return [];
  }
};
