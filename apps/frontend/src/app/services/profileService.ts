import { useOrgStore } from "../stores/orgStore";
import { useUserProfileStore } from "../stores/profileStore";
import { UserProfile, UserProfileResponse } from "../types/profile";
import { getData, postData, putData } from "./axios";

export const loadProfiles = async (opts?: { silent?: boolean }) => {
  const { startLoading, setProfiles } = useUserProfileStore.getState();
  const { orgIds } = useOrgStore.getState();
  if (!opts?.silent) {
    startLoading();
  }
  try {
    if (orgIds.length === 0) {
      return;
    }
    const temp: UserProfile[] = [];
    await Promise.allSettled(
      orgIds.map(async (orgId) => {
        try {
          const res = await getData<UserProfile>(
            `/fhir/v1/user-profile/${orgId}/profile`
          );
          temp.push(res.data);
        } catch (err) {
          console.error(`Failed to fetch profile for orgId: ${orgId}`, err);
        }
      })
    );
    setProfiles(temp);
  } catch (err: any) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

export const createUserProfile = async (
  formData: UserProfile,
  orgIdFromQuery: string | null
) => {
  const { startLoading, addProfile } = useUserProfileStore.getState();
  startLoading();
  try {
    if (!orgIdFromQuery) return;
    const payload: UserProfile = {
      ...formData,
      organizationId: orgIdFromQuery,
    };
    const res = await postData<UserProfileResponse>(
      "/fhir/v1/user-profile/" + orgIdFromQuery,
      payload
    );
    const data = res.data;
    const newProfile: UserProfile = {
      _id: data._id,
      organizationId: data.organizationId,
      personalDetails: data.personalDetails,
      professionalDetails: data.professionalDetails,
    };
    addProfile(newProfile);
  } catch (err: unknown) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

export const updateUserProfile = async (
  formData: UserProfile,
  orgIdFromQuery: string | null
) => {
  const { startLoading, updateProfile } = useUserProfileStore.getState();
  startLoading();
  try {
    if (!orgIdFromQuery) return;
    const payload: UserProfile = {
      ...formData,
      organizationId: orgIdFromQuery,
    };
    const res = await putData<UserProfile>(
      "/fhir/v1/user-profile/" + orgIdFromQuery + "/profile",
      payload
    );
    updateProfile(res.data);
  } catch (err: unknown) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};
