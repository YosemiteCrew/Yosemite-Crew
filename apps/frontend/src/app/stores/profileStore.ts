import { create } from "zustand";
import type { UserProfile } from "../types/profile";

export type UserProfileStatus = "idle" | "loading" | "loaded" | "error";

type UserProfileState = {
  profilesByOrgId: Record<string, UserProfile>;

  status: UserProfileStatus;
  error: string | null;

  setProfiles: (profiles: UserProfile[]) => void;
  addProfile: (profile: UserProfile) => void;
  updateProfile: (profile: UserProfile) => void;
  getProfileById: (orgId: string) => UserProfile | undefined;
  clearProfiles: () => void;

  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useUserProfileStore = create<UserProfileState>()((set, get) => ({
  profilesByOrgId: {},

  status: "idle",
  error: null,

  setProfiles: (profiles) =>
    set(() => {
      const profilesByOrgId: Record<string, UserProfile> = {};
      for (const p of profiles) {
        if (!p.organizationId) {
          console.warn(
            "setProfiles: skipping profile without organizationId",
            p
          );
          continue;
        }
        profilesByOrgId[p.organizationId] = p;
      }
      return { profilesByOrgId, status: "loaded", error: null };
    }),

  addProfile: (profile) =>
    set((state) => {
      if (!profile.organizationId) {
        console.warn("addProfile: missing organizationId on profile", profile);
        return state;
      }
      return {
        profilesByOrgId: {
          ...state.profilesByOrgId,
          [profile.organizationId]: profile,
        },
      };
    }),

  updateProfile: (profile) =>
    set((state) => {
      const orgId = profile.organizationId;
      if (!orgId) {
        console.warn(
          "updateProfile: missing organizationId on profile",
          profile
        );
        return state;
      }
      const existing = state.profilesByOrgId[orgId];
      if (!existing) {
        console.warn(
          `updateProfile: profile not found for organizationId=${orgId}`
        );
        return state;
      }
      return {
        profilesByOrgId: {
          ...state.profilesByOrgId,
          [orgId]: {
            ...existing,
            ...profile,
          },
        },
      };
    }),

  getProfileById: (orgId) => {
    const { profilesByOrgId } = get();
    return profilesByOrgId[orgId];
  },

  clearProfiles: () =>
    set(() => ({
      profilesById: {},
      status: "idle",
      error: null,
    })),

  startLoading: () =>
    set(() => ({
      status: "loading",
      error: null,
    })),

  endLoading: () =>
    set(() => ({
      status: "loaded",
    })),

  setError: (message) =>
    set(() => ({
      status: "error",
      error: message,
    })),
}));
