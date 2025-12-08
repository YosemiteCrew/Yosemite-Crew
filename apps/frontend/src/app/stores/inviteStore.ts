import { create } from "zustand";
import { InviteProps } from "../types/org";

type InviteStatus = "idle" | "loading" | "loaded" | "error";

type InviteState = {
  invites: InviteProps[];
  status: InviteStatus;
  error: string | null;

  setInvites: (invites: InviteProps[]) => void;

  startLoading: () => void;
  setError: (msg: string) => void;
  clearInvites: () => void;
};

export const useInviteStore = create<InviteState>()((set) => ({
  invites: [],
  status: "idle",
  error: null,

  setInvites: (invites) =>
    set(() => ({
      invites,
      status: "loaded",
      error: null,
    })),

  startLoading: () =>
    set(() => ({
      status: "loading",
      error: null,
    })),

  setError: (msg) =>
    set(() => ({
      status: "error",
      error: msg,
    })),

  clearInvites: () =>
    set(() => ({
      invites: [],
      status: "idle",
      error: null,
    })),
}));
