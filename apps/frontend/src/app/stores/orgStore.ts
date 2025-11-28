import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Membership, Org, OrgWithMembership } from "@/app/types/org";

type OrgState = {
  orgsById: Record<string, Org>;
  orgIds: string[];
  membershipsByOrgId: Record<string, Membership>;
  primaryOrgId: string | null;

  setOrgs: (
    orgs: OrgWithMembership[],
    opts?: { keepPrimaryIfPresent?: boolean }
  ) => void;
  upsertOrg: (org: OrgWithMembership) => void;
  updateOrg: (orgId: string, patch: Partial<Org>) => void;
  getOrgById: (orgId: string) => Org | null;
  getPrimaryOrg: () => Org | null;
  removeOrg: (orgId: string) => void;
  clearOrgs: () => void;
};

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      orgsById: {},
      orgIds: [],
      membershipsByOrgId: {},
      primaryOrgId: null,

      setOrgs: (orgs, opts) =>
        set((state) => {
          const orgsById: Record<string, Org> = {};
          const membershipsByOrgId: Record<string, Membership> = {};
          const orgIds: string[] = [];
          for (const o of orgs) {
            orgsById[o.id] = {
              id: o.id,
              name: o.name,
              type: o.type,
              isActive: o.isActive,
              isVerified: o.isVerified,
            };
            membershipsByOrgId[o.id] = {
              orgId: o.id,
              role: o.membership.role,
              permissions: o.membership.permissions ?? [],
            };
            orgIds.push(o.id);
          }
          let primaryOrgId: string | null = null;
          if (opts?.keepPrimaryIfPresent && state.primaryOrgId) {
            primaryOrgId = orgIds.includes(state.primaryOrgId)
              ? state.primaryOrgId
              : (orgIds[0] ?? null);
          } else {
            primaryOrgId = orgIds[0] ?? null;
          }
          return {
            orgsById,
            orgIds,
            membershipsByOrgId,
            primaryOrgId,
          };
        }),

      upsertOrg: (org) =>
        set((state) => {
          const exists = !!state.orgsById[org.id];
          const orgsById: Record<string, Org> = {
            ...state.orgsById,
            [org.id]: {
              id: org.id,
              name: org.name,
              type: org.type,
              isActive: org.isActive,
              isVerified: org.isVerified,
            },
          };
          const membershipsByOrgId: Record<string, Membership> = {
            ...state.membershipsByOrgId,
            [org.id]: {
              orgId: org.id,
              role: org.membership.role,
              permissions: org.membership.permissions ?? [],
            },
          };
          const orgIds = exists ? state.orgIds : [...state.orgIds, org.id];
          return { orgsById, membershipsByOrgId, orgIds };
        }),

      updateOrg: (orgId, patch) =>
        set((state) => {
          const existing = state.orgsById[orgId];
          if (!existing) return state;
          const updated: Org = {
            ...existing,
            ...patch,
          };
          return {
            orgsById: {
              ...state.orgsById,
              [orgId]: updated,
            },
          };
        }),

      getOrgById: (orgId) => {
        const { orgsById } = get();
        return orgsById[orgId] ?? null;
      },

      getPrimaryOrg: () => {
        const { primaryOrgId, orgsById } = get();
        if (!primaryOrgId) return null;
        return orgsById[primaryOrgId] ?? null;
      },

      removeOrg: (orgId) =>
        set((state) => {
          if (!state.orgsById[orgId]) return state;
          const { [orgId]: _, ...nextOrgsById } = state.orgsById;
          const { [orgId]: __, ...nextMembershipsByOrgId } =
            state.membershipsByOrgId;
          const nextOrgIds = state.orgIds.filter((id) => id !== orgId);
          const nextPrimaryOrgId =
            state.primaryOrgId === orgId
              ? (nextOrgIds[0] ?? null)
              : state.primaryOrgId;
          return {
            orgsById: nextOrgsById,
            membershipsByOrgId: nextMembershipsByOrgId,
            orgIds: nextOrgIds,
            primaryOrgId: nextPrimaryOrgId,
          };
        }),

      clearOrgs: () =>
        set(() => ({
          orgsById: {},
          membershipsByOrgId: {},
          orgIds: [],
          primaryOrgId: null,
        })),
    }),
    {
      name: "org-store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        orgsById: state.orgsById,
        orgIds: state.orgIds,
        membershipsByOrgId: state.membershipsByOrgId,
        primaryOrgId: state.primaryOrgId,
      }),
      migrate: (persisted: any, _version) => {
        return persisted;
      },
    }
  )
);
