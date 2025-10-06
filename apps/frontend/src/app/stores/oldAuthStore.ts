import { create } from "zustand";
import ProfileApi from "../utils/api/profileApi";
import {
  BusinessProfile,
  ConvertToFhirVetProfileParams,
} from "@yosemite-crew/types";

type UserType =
  | "Doctor"
  | "Hospital"
  | "Groomer Shop"
  | "receptionist"
  | "vet"
  | "veterinaryBusiness";

type OldAuthStore = {
  userId: string | null;
  email: string | null;
  userType: UserType | null;
  isVerified: number | null;
  setUser: (user: {
    userId: string;
    email: string;
    userType: UserType;
    isVerified: number;
  }) => void;
  logout: () => void;
  setVerified: (value?: number) => void;
  profile: BusinessProfile | null;
  vetAndTeamsProfile: ConvertToFhirVetProfileParams | null;
  loading: boolean;
  error: string | null;
  fetchBusinessProfile: () => Promise<void>;
  fetchVetAndTeamsProfile: (userId: string) => Promise<void>; // ✅ accepts param
};

export const useOldAuthStore = create<OldAuthStore>((set) => ({
  userId: null,
  email: null,
  userType: null,
  isVerified: null,
  profile: null,
  vetAndTeamsProfile: null,
  loading: false,
  error: null,

  setUser: ({ userId, email, userType, isVerified }) => {
    set({ userId, email, userType, isVerified });
  },

  logout: () => {
    set({
      userId: null,
      email: null,
      userType: null,
      isVerified: null,
      profile: null,
      vetAndTeamsProfile: null,
      loading: false,
      error: null,
    });
  },

  setVerified: (value: number = 0) => {
    set({ isVerified: value });
  },

  fetchBusinessProfile: async () => {
    set({ loading: true, error: null });
    try {
      const userId = useOldAuthStore.getState().userId;
      if (!userId) throw new Error("User ID not found");

      const data = await ProfileApi.getBusinessProfile(userId);
      set({ profile: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchVetAndTeamsProfile: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      if (!userId) throw new Error("User ID not found");
      const data = await ProfileApi.getVetAndTeamsProfile(userId);
      set({ vetAndTeamsProfile: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
}));
