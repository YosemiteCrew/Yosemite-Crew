import { create } from 'zustand';

type SigningCloseHandler = () => void | Promise<void>;

const closeHandlers = new Map<string, SigningCloseHandler>();

type SigningOverlayState = {
  open: boolean;
  url: string | null;
  pending: boolean;
  submissionId: string | null;
  openOverlay: (submissionId: string) => void;
  setUrl: (url: string) => void;
  registerCloseHandler: (submissionId: string, handler: SigningCloseHandler) => void;
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
  registerCloseHandler: (submissionId: string, handler: SigningCloseHandler) => {
    closeHandlers.set(submissionId, handler);
  },
  close: () =>
    set((state) => {
      const submissionId = state.submissionId;
      if (submissionId) {
        const handler = closeHandlers.get(submissionId);
        closeHandlers.delete(submissionId);
        if (handler) {
          void handler();
        }
      }
      return { open: false, url: null, pending: false, submissionId: null };
    }),
}));
