import { create } from "zustand";
import {
  BillingSubscription,
  BillingSubscriptionAccessState,
  BillingSubscriptionInterval,
  BillingSubscriptionStatus,
} from "../types/billing";

type BillingStatus = "idle" | "loading" | "loaded" | "error";

type BillingSubscriptionState = {
  subscriptionByOrgId: Record<string, BillingSubscription>;

  status: BillingStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setSubscriptions: (subs: BillingSubscription[]) => void;
  setSubscriptionForOrg: (
    orgId: string,
    sub: BillingSubscription | null
  ) => void;

  upsertSubscription: (sub: BillingSubscription) => void;
  removeSubscriptionForOrg: (orgId: string) => void;

  getSubscriptionByOrgId: (orgId: string) => BillingSubscription | null;
  patchSubscription: (
    orgId: string,
    patch: Partial<Omit<BillingSubscription, "orgId">>
  ) => void;
  upgradeToBusiness: (
    orgId: string,
    interval: BillingSubscriptionInterval,
    opts?: {
      currency?: string;
      seatQuantity?: number;
      accessState?: BillingSubscriptionAccessState;
    }
  ) => void;
  downgradeToFree: (
    orgId: string,
    opts?: {
      accessState?: BillingSubscriptionAccessState;
      subscriptionStatus?: BillingSubscriptionStatus;
      keepSeatQuantity?: boolean;
    }
  ) => void;

  clearSubscriptions: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useSubscriptionStore = create<BillingSubscriptionState>()(
  (set, get) => ({
    subscriptionByOrgId: {},

    status: "idle",
    error: null,
    lastFetchedAt: null,

    setSubscriptions: (subs) =>
      set(() => {
        const subscriptionByOrgId: Record<string, BillingSubscription> = {};
        for (const s of subs) {
          if (!s?.orgId) continue;
          subscriptionByOrgId[s.orgId] = s;
        }
        return {
          subscriptionByOrgId,
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }),

    setSubscriptionForOrg: (orgId, sub) =>
      set((state) => {
        if (!orgId) return state;

        if (!sub) {
          const { [orgId]: _, ...rest } = state.subscriptionByOrgId;
          return {
            subscriptionByOrgId: rest,
            status: "loaded",
            error: null,
            lastFetchedAt: new Date().toISOString(),
          };
        }

        return {
          subscriptionByOrgId: {
            ...state.subscriptionByOrgId,
            [orgId]: { ...sub, orgId },
          },
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }),

    upsertSubscription: (sub) =>
      set((state) => {
        const orgId = sub?.orgId;
        if (!orgId) {
          console.warn("upsertSubscription: invalid subscription", sub);
          return state;
        }

        return {
          subscriptionByOrgId: {
            ...state.subscriptionByOrgId,
            [orgId]: {
              ...(state.subscriptionByOrgId[orgId] ??
                ({} as BillingSubscription)),
              ...sub,
              orgId,
            },
          },
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }),

    removeSubscriptionForOrg: (orgId) =>
      set((state) => {
        const { [orgId]: _, ...rest } = state.subscriptionByOrgId;
        return { subscriptionByOrgId: rest };
      }),

    getSubscriptionByOrgId: (orgId) => {
      const { subscriptionByOrgId } = get();
      return subscriptionByOrgId[orgId] ?? null;
    },

    patchSubscription: (orgId, patch) =>
      set((state) => {
        const prev = state.subscriptionByOrgId[orgId];
        if (!prev) return state;

        return {
          subscriptionByOrgId: {
            ...state.subscriptionByOrgId,
            [orgId]: { ...prev, ...patch, orgId },
          },
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }),

    upgradeToBusiness: (orgId, interval, opts) =>
      set((state) => {
        const prev = state.subscriptionByOrgId[orgId];
        if (!prev) return state;

        const next: BillingSubscription = {
          ...prev,
          orgId,
          plan: "business",
          billingInterval: interval,
          currency: opts?.currency ?? prev.currency,
          seatQuantity: opts?.seatQuantity ?? prev.seatQuantity,
          accessState: opts?.accessState ?? "active",
          upgradedAt: new Date(),
        };

        return {
          subscriptionByOrgId: { ...state.subscriptionByOrgId, [orgId]: next },
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }),

    downgradeToFree: (orgId, opts) =>
      set((state) => {
        const prev = state.subscriptionByOrgId[orgId];
        if (!prev) return state;

        const next: BillingSubscription = {
          ...prev,
          orgId,

          plan: "free",
          billingInterval: undefined,

          subscriptionStatus: opts?.subscriptionStatus ?? "none",
          accessState: opts?.accessState ?? "free",

          seatQuantity: opts?.keepSeatQuantity ? prev.seatQuantity : 0,

          cancelAtPeriodEnd: false,
          downgradedAt: new Date(),
        };

        return {
          subscriptionByOrgId: {
            ...state.subscriptionByOrgId,
            [orgId]: next,
          },
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }),

    clearSubscriptions: () =>
      set(() => ({
        subscriptionByOrgId: {},
        status: "idle",
        error: null,
        lastFetchedAt: null,
      })),

    startLoading: () => set(() => ({ status: "loading", error: null })),

    endLoading: () => set(() => ({ status: "loaded", error: null })),

    setError: (message) => set(() => ({ status: "error", error: message })),
  })
);
