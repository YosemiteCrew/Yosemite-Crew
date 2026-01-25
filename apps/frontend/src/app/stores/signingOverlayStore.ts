import { create } from "zustand";

type SigningOverlayState = {
  open: boolean;
  url: string | null;
  pending: boolean;
  submissionId: string | null;
  openOverlay: (submissionId: string) => void;
  setUrl: (url: string) => void;
  close: () => void;
};

export const useSigningOverlayStore = create<SigningOverlayState>()((set) => ({
  open: false,
  url: null,
  pending: false,
  submissionId: null,
  openOverlay: (submissionId: string) =>
    set({ open: true, pending: true, submissionId, url: null }),
  setUrl: (url: string) => set({ url, pending: false, open: true }),
  close: () => set({ open: false, url: null, pending: false, submissionId: null }),
}));
