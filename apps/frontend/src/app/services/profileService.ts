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
          const res = await getData<any>(
            `/fhir/v1/user-profile/${orgId}/profile`
          );
          const pro = res.data;
          temp.push(pro.profile);
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
  const { startLoading, addProfile, updateProfile } =
    useUserProfileStore.getState();
  startLoading();
  try {
    if (!orgIdFromQuery) return;
    const payload: UserProfile = {
      ...formData,
      organizationId: orgIdFromQuery,
    };
    const endpoint = "/fhir/v1/user-profile/" + orgIdFromQuery + "/profile";

    // Check if profile exists and is in DRAFT status
    let isDraft = false;
    try {
      const existingProfile = await getData<{ profile: UserProfile }>(endpoint);
      if (existingProfile.data?.profile?.status === "DRAFT") {
        isDraft = true;
      }
    } catch {
      // Profile doesn't exist, proceed with POST
    }

    const res = isDraft
      ? await putData<UserProfileResponse>(endpoint, payload)
      : await postData<UserProfileResponse>(endpoint, payload);

    const data = res.data;
    const newProfile: UserProfile = {
      _id: data._id,
      organizationId: data.organizationId,
      personalDetails: data.personalDetails,
    };

    if (isDraft) {
      updateProfile(newProfile);
    } else {
      addProfile(newProfile);
    }
  } catch (err: unknown) {
    console.error("Failed to create/update profile:", err);
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

export const upsertUserProfile = async (formData: UserProfile) => {
  const { startLoading, updateProfile } = useUserProfileStore.getState();
  startLoading();
  try {
    const res = await putData<UserProfile>(
      "/fhir/v1/user-profile/" + formData.organizationId + "/profile",
      formData
    );
    updateProfile(res.data);
  } catch (err: unknown) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};
