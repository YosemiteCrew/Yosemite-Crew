import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { UserProfile, UserProfileResponse } from '@/app/features/users/types/profile';
import { getData, postData, putData } from '@/app/services/axios';
import {
  getSystemTimeZone,
  getTimezoneSyncModeForOrg,
  parseTimezoneFromProfileValue,
  setPreferredTimeZone,
} from '@/app/lib/timezone';

const syncProfileTimezoneToLocalDevice = async (
  orgId: string,
  profile: UserProfile
): Promise<UserProfile> => {
  if (typeof window === 'undefined') return profile;
  const syncMode = getTimezoneSyncModeForOrg(orgId);
  if (syncMode === 'custom') {
    const profileTimeZone = parseTimezoneFromProfileValue(profile.personalDetails?.timezone);
    setPreferredTimeZone(profileTimeZone);
    return profile;
  }

  const systemTimeZone = getSystemTimeZone();
  setPreferredTimeZone(systemTimeZone);
  const rawProfileTimeZone = profile.personalDetails?.timezone;
  const profileTimeZone = parseTimezoneFromProfileValue(rawProfileTimeZone);
  const shouldUpdateBackendTimezone = !rawProfileTimeZone || profileTimeZone !== systemTimeZone;
  if (!shouldUpdateBackendTimezone) {
    return profile;
  }

  try {
    const payload: UserProfile = {
      ...profile,
      organizationId: profile.organizationId || orgId,
      personalDetails: {
        ...profile.personalDetails,
        timezone: systemTimeZone,
      },
    };
    const res = await putData<{ profile?: UserProfile } | UserProfile>(
      '/fhir/v1/user-profile/' + orgId + '/profile',
      payload
    );
    const responseData = res.data;
    const persistedProfile =
      (responseData as { profile?: UserProfile }).profile ?? (responseData as UserProfile);
    if (persistedProfile && Object.keys(persistedProfile).length > 0) {
      return persistedProfile;
    }
    return payload;
  } catch (error) {
    console.error('Failed to sync profile timezone with local device timezone:', error);
    return profile;
  }
};

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
          const res = await getData<any>(`/fhir/v1/user-profile/${orgId}/profile`);
          const pro = res.data;
          const profile = pro.profile as UserProfile;
          const syncedProfile = await syncProfileTimezoneToLocalDevice(orgId, profile);
          temp.push(syncedProfile);
        } catch (err) {
          console.error(`Failed to fetch profile for orgId: ${orgId}`, err);
        }
      })
    );
    setProfiles(temp);
  } catch (err: any) {
    console.error('Failed to load orgs:', err);
    throw err;
  }
};

export const createUserProfile = async (formData: UserProfile, orgIdFromQuery: string | null) => {
  const { startLoading, addProfile, updateProfile } = useUserProfileStore.getState();
  startLoading();
  try {
    if (!orgIdFromQuery) return;
    const payload: UserProfile = {
      ...formData,
      organizationId: orgIdFromQuery,
    };
    const endpoint = '/fhir/v1/user-profile/' + orgIdFromQuery + '/profile';

    // Check if profile exists and is in DRAFT status
    let isDraft = false;
    try {
      const existingProfile = await getData<{ profile: UserProfile }>(endpoint);
      if (existingProfile.data?.profile?.status === 'DRAFT') {
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
    console.error('Failed to create/update profile:', err);
    throw err;
  }
};

export const updateUserProfile = async (formData: UserProfile, orgIdFromQuery: string | null) => {
  const { startLoading, updateProfile } = useUserProfileStore.getState();
  startLoading();
  try {
    if (!orgIdFromQuery) return;
    const payload: UserProfile = {
      ...formData,
      organizationId: orgIdFromQuery,
    };
    const res = await putData<UserProfile>(
      '/fhir/v1/user-profile/' + orgIdFromQuery + '/profile',
      payload
    );
    updateProfile(res.data);
  } catch (err: unknown) {
    console.error('Failed to load orgs:', err);
    throw err;
  }
};

export const upsertUserProfile = async (formData: UserProfile) => {
  const { startLoading, updateProfile } = useUserProfileStore.getState();
  startLoading();
  try {
    const res = await putData<UserProfile>(
      '/fhir/v1/user-profile/' + formData.organizationId + '/profile',
      formData
    );
    updateProfile(res.data);
  } catch (err: unknown) {
    console.error('Failed to load orgs:', err);
    throw err;
  }
};

type PatchUserProfilePayload = Partial<
  Pick<UserProfile, 'personalDetails' | 'professionalDetails' | 'status'>
>;

export const patchUserProfile = async (orgId: string, payload: PatchUserProfilePayload) => {
  const { startLoading, updateProfile, addProfile, getProfileById } =
    useUserProfileStore.getState();
  startLoading();
  try {
    const endpoint = '/fhir/v1/user-profile/' + orgId + '/profile';
    let existing = getProfileById(orgId);
    if (!existing) {
      const existingRes = await getData<{ profile?: UserProfile } | UserProfile>(endpoint);
      const existingData = existingRes.data;
      existing =
        (existingData as { profile?: UserProfile }).profile ?? (existingData as UserProfile);
    }
    const nextProfile: UserProfile = {
      ...(existing ?? {}),
      organizationId: existing?.organizationId ?? orgId,
      personalDetails: {
        ...existing?.personalDetails,
        ...payload.personalDetails,
      },
      professionalDetails: {
        ...existing?.professionalDetails,
        ...payload.professionalDetails,
      },
      _id: existing?._id ?? orgId,
    };
    const res = await putData<{ profile?: UserProfile } | UserProfile>(endpoint, nextProfile);
    const responseData = res.data;
    const persistedProfile: UserProfile | undefined =
      (responseData as { profile?: UserProfile }).profile ?? (responseData as UserProfile);
    const profileToStore = persistedProfile ?? nextProfile;

    if (existing) {
      updateProfile(profileToStore);
    } else {
      addProfile(profileToStore);
    }
    return profileToStore;
  } catch (err: unknown) {
    console.error('Failed to patch profile:', err);
    throw err;
  }
};
