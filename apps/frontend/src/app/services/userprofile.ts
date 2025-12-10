import { UserProfile } from "@yosemite-crew/types";
import { useOrgStore } from "../stores/orgStore";
import { getData } from "./axios";

export const loadUserProfileByorg = async (): Promise<void> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;

  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load profile.");
    return;
  }

  try {
    const res = await getData<UserProfile>(`/fhir/v1/user-profile/${primaryOrgId}`);
    console.log(res.data);
  } catch (err) {
    console.error("Failed to load specialities:", err);
    throw err;
  }
};
