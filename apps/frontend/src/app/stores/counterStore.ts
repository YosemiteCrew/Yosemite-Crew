import { create } from "zustand";
import { BillingCounter } from "../types/billing";

type CounterStatus = "idle" | "loading" | "loaded" | "error";

type CounterPatch = Partial<Omit<BillingCounter, "orgId">>;

type CounterState = {
  countersByOrgId: Record<string, BillingCounter>;

  status: CounterStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setCounters: (counters: BillingCounter[]) => void;
  setCounterForOrg: (orgId: string, counter: BillingCounter | null) => void;

  upsertCounter: (counter: BillingCounter) => void;
  removeCounterForOrg: (orgId: string) => void;

  getCounterByOrgId: (orgId: string) => BillingCounter | null;
  patchCounter: (orgId: string, patch: CounterPatch) => void;
  increaseToolsUsed: (orgId: string, by?: number) => void;
  decreaseToolsUsed: (orgId: string, by?: number) => void;
  increaseAppointmentsUsed: (orgId: string, by?: number) => void;
  decreaseAppointmentsUsed: (orgId: string, by?: number) => void;
  increaseUsersActiveCount: (orgId: string, by?: number) => void;
  decreaseUsersActiveCount: (orgId: string, by?: number) => void;
  increaseUsersBillableCount: (orgId: string, by?: number) => void;
  decreaseUsersBillableCount: (orgId: string, by?: number) => void;

  clearCounters: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

const clamp0 = (n: number) => Math.max(0, n);

export const useCounterStore = create<CounterState>()((set, get) => ({
  countersByOrgId: {},

  status: "idle",
  error: null,
  lastFetchedAt: null,

  setCounters: (counters) =>
    set(() => {
      const countersByOrgId: Record<string, BillingCounter> = {};
      for (const c of counters) {
        if (!c?.orgId) continue;
        countersByOrgId[c.orgId] = c;
      }
      return {
        countersByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  setCounterForOrg: (orgId, counter) =>
    set((state) => {
      if (!orgId) return state;

      if (!counter) {
        const { [orgId]: _, ...rest } = state.countersByOrgId;
        return {
          countersByOrgId: rest,
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }

      return {
        countersByOrgId: {
          ...state.countersByOrgId,
          [orgId]: { ...counter, orgId },
        },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertCounter: (counter) =>
    set((state) => {
      const orgId = counter?.orgId;
      if (!orgId) {
        console.warn("upsertCounter: invalid counter", counter);
        return state;
      }

      return {
        countersByOrgId: {
          ...state.countersByOrgId,
          [orgId]: {
            ...(state.countersByOrgId[orgId] ?? ({} as BillingCounter)),
            ...counter,
            orgId,
          },
        },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  removeCounterForOrg: (orgId) =>
    set((state) => {
      const { [orgId]: _, ...rest } = state.countersByOrgId;
      return { countersByOrgId: rest };
    }),

  getCounterByOrgId: (orgId) => {
    const { countersByOrgId } = get();
    return countersByOrgId[orgId] ?? null;
  },

  patchCounter: (orgId, patch) =>
    set((state) => {
      const prev = state.countersByOrgId[orgId];
      if (!prev) return state;

      return {
        countersByOrgId: {
          ...state.countersByOrgId,
          [orgId]: { ...prev, ...patch, orgId },
        },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),
  increaseToolsUsed: (orgId, by = 1) =>
    set((state) => {
      const prev = state.countersByOrgId[orgId];
      if (!prev) return state;
      const next = {
        ...prev,
        toolsUsed: (prev.toolsUsed ?? 0) + by,
      };
      return {
        countersByOrgId: { ...state.countersByOrgId, [orgId]: next },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  decreaseToolsUsed: (orgId, by = 1) =>
    set((state) => {
      const prev = state.countersByOrgId[orgId];
      if (!prev) return state;
      const next = {
        ...prev,
        toolsUsed: clamp0((prev.toolsUsed ?? 0) - by),
      };
      return {
        countersByOrgId: { ...state.countersByOrgId, [orgId]: next },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  increaseAppointmentsUsed: (orgId, by = 1) =>
    set((state) => {
      const prev = state.countersByOrgId[orgId];
      if (!prev) return state;
      const next = {
        ...prev,
        appointmentsUsed: (prev.appointmentsUsed ?? 0) + by,
      };
      return {
        countersByOrgId: { ...state.countersByOrgId, [orgId]: next },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  decreaseAppointmentsUsed: (orgId, by = 1) =>
    set((state) => {
      const prev = state.countersByOrgId[orgId];
      if (!prev) return state;
      const next = {
        ...prev,
        appointmentsUsed: clamp0((prev.appointmentsUsed ?? 0) - by),
      };
      return {
        countersByOrgId: { ...state.countersByOrgId, [orgId]: next },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  increaseUsersActiveCount: (orgId, by = 1) =>
    set((state) => {
      const prev = state.countersByOrgId[orgId];
      if (!prev) return state;
      const next = {
        ...prev,
        usersActiveCount: (prev.usersActiveCount ?? 0) + by,
      };
      return {
        countersByOrgId: { ...state.countersByOrgId, [orgId]: next },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  decreaseUsersActiveCount: (orgId, by = 1) =>
    set((state) => {
      const prev = state.countersByOrgId[orgId];
      if (!prev) return state;
      const next = {
        ...prev,
        usersActiveCount: clamp0((prev.usersActiveCount ?? 0) - by),
      };
      return {
        countersByOrgId: { ...state.countersByOrgId, [orgId]: next },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  increaseUsersBillableCount: (orgId, by = 1) =>
    set((state) => {
      const prev = state.countersByOrgId[orgId];
      if (!prev) return state;
      const next = {
        ...prev,
        usersBillableCount: (prev.usersBillableCount ?? 0) + by,
      };
      return {
        countersByOrgId: { ...state.countersByOrgId, [orgId]: next },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  decreaseUsersBillableCount: (orgId, by = 1) =>
    set((state) => {
      const prev = state.countersByOrgId[orgId];
      if (!prev) return state;
      const next = {
        ...prev,
        usersBillableCount: clamp0((prev.usersBillableCount ?? 0) - by),
      };
      return {
        countersByOrgId: { ...state.countersByOrgId, [orgId]: next },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  clearCounters: () =>
    set(() => ({
      countersByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    })),

  startLoading: () => set(() => ({ status: "loading", error: null })),

  endLoading: () => set(() => ({ status: "loaded", error: null })),

  setError: (message) => set(() => ({ status: "error", error: message })),
}));
