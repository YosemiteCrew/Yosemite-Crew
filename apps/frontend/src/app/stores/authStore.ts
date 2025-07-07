import { create } from 'zustand';

type UserType = 'Doctor' | 'Hospital' | 'Groomer Shop' | string;

type AuthStore = {
  userId: string | null;
  email: string | null;
  userType: UserType | null;
  setUser: (user: { userId: string; email: string; userType: UserType }) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  userId: null,
  email: null,
  userType: null,

  setUser: ({ userId, email, userType }) => {
    set({ userId, email, userType });
  },

  logout: () => {
    set({ userId: null, email: null, userType: null });
  },
}));
