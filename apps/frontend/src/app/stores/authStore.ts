import { create } from 'zustand';
import ProfileApi from '../utils/Api/profileApi';
import { BusinessProfile, ConvertToFhirVetProfileParams } from '@yosemite-crew/types';

type UserType = 'Doctor' | 'Hospital' | 'Groomer Shop' | string;

type AuthStore = {
  userId: string | null;
  email: string | null;
  userType: UserType | null;
  isVerified: boolean;
  setUser: (user: { userId: string; email: string; userType: UserType }) => void;
  logout: () => void;
  setVerified: (value?: boolean) => void;
  profile: BusinessProfile | null;
  vetAndTeamsProfile: ConvertToFhirVetProfileParams | null;
  loading: boolean;
  error: string | null;
  fetchBusinessProfile: () => Promise<void>;
  fetchVetAndTeamsProfile: (userId: string) => Promise<void>; // ✅ accepts param
};

export const useAuthStore = create<AuthStore>((set) => ({
  userId: null,
  email: null,
  userType: null,
  isVerified: false,
  profile: null,
  vetAndTeamsProfile: null,
  loading: false,
  error: null,

  setUser: ({ userId, email, userType }) => {
    set({ userId, email, userType });
  },

  logout: () => {
    set({
      userId: null,
      email: null,
      userType: null,
      isVerified: false,
      profile: null,
      vetAndTeamsProfile: null,
      loading: false,
      error: null,
    });
  },

  setVerified: (value: boolean = true) => {
    set({ isVerified: value });
  },

  fetchBusinessProfile: async () => {
    set({ loading: true, error: null });
    try {
      const userId = useAuthStore.getState().userId;
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
  }
}));
