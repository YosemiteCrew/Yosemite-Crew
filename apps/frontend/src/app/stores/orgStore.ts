import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Organisation, UserOrganization } from "@yosemite-crew/types";

type OrgStatus = "idle" | "loading" | "loaded" | "error";

type OrgState = {
  orgsById: Record<string, Organisation>;
  orgIds: string[];
  primaryOrgId: string | null;
  membershipsByOrgId: Record<string, UserOrganization>;

  status: OrgStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setOrgs: (
    orgs: Organisation[],
    opts?: { keepPrimaryIfPresent?: boolean }
  ) => void;
  upsertOrg: (org: Organisation) => void;
  updateOrg: (orgId: string, patch: Partial<Organisation>) => void;
  getOrgById: (orgId: string) => Organisation | null;
  getPrimaryOrg: () => Organisation | null;
  setPrimaryOrg: (orgId: string | null) => void;
  removeOrg: (orgId: string) => void;
  clearOrgs: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;

  setUserOrgMappings: (mappings: UserOrganization[]) => void;
  upsertUserOrgMapping: (mapping: UserOrganization) => void;
  getUserOrgMappingsByOrgId: (orgId: string) => UserOrganization | null;
  getCombinedUserOrgByOrgId: (
    orgId: string
  ) => { org: Organisation; membership: UserOrganization | null } | null;
};

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      orgsById: {},
      orgIds: [],
      primaryOrgId: null,
      membershipsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,

      setOrgs: (orgs, opts) =>
        set((state) => {
          const orgsById: Record<string, Organisation> = {};
          const orgIds: string[] = [];
          for (const o of orgs) {
            const id = o._id?.toString() || o.name;
            orgsById[id] = {
              _id: id,
              name: o.name,
              DUNSNumber: o.DUNSNumber,
              imageURL: o.imageURL,
              type: o.type,
              phoneNo: o.phoneNo,
              website: o.website,
              address: o.address,
              isVerified: o.isVerified,
              isActive: o.isActive,
              taxId: o.taxId,
              healthAndSafetyCertNo: o.healthAndSafetyCertNo,
              animalWelfareComplianceCertNo: o.animalWelfareComplianceCertNo,
              fireAndEmergencyCertNo: o.fireAndEmergencyCertNo,
              googlePlacesId: o.googlePlacesId,
            };
            orgIds.push(id);
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
            primaryOrgId,
            status: "loaded",
            error: null,
            lastFetchedAt: new Date().toISOString(),
          };
        }),

      upsertOrg: (org) =>
        set((state) => {
          const id = org._id?.toString() || org.name;
          const exists = !!state.orgsById[id];
          const orgsById: Record<string, Organisation> = {
            ...state.orgsById,
            [id]: {
              _id: id,
              name: org.name,
              DUNSNumber: org.DUNSNumber,
              imageURL: org.imageURL,
              type: org.type,
              phoneNo: org.phoneNo,
              website: org.website,
              address: org.address,
              isVerified: org.isVerified,
              isActive: org.isActive,
              taxId: org.taxId,
              healthAndSafetyCertNo: org.healthAndSafetyCertNo,
              animalWelfareComplianceCertNo: org.animalWelfareComplianceCertNo,
              fireAndEmergencyCertNo: org.fireAndEmergencyCertNo,
              googlePlacesId: org.googlePlacesId,
            },
          };
          const orgIds = exists ? state.orgIds : [...state.orgIds, id];
          return { orgsById, orgIds, status: "loaded" };
        }),

      updateOrg: (orgId, patch) =>
        set((state) => {
          const existing = state.orgsById[orgId];
          if (!existing) return state;
          const updated: Organisation = {
            ...existing,
            ...patch,
          };
          return {
            orgsById: {
              ...state.orgsById,
              [orgId]: updated,
            },
            status: "loaded",
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

      setPrimaryOrg: (orgId) =>
        set((state) => {
          if (orgId && !state.orgsById[orgId]) {
            return state;
          }
          return {
            primaryOrgId: orgId,
          };
        }),

      removeOrg: (orgId) =>
        set((state) => {
          if (!state.orgsById[orgId]) return state;
          const { [orgId]: _removedOrg, ...nextOrgsById } = state.orgsById;
          const nextOrgIds = state.orgIds.filter((id) => id !== orgId);
          const nextPrimaryOrgId =
            state.primaryOrgId === orgId
              ? (nextOrgIds[0] ?? null)
              : state.primaryOrgId;
          const { [orgId]: _removedMemberships, ...nextMemberships } =
            state.membershipsByOrgId;
          return {
            orgsById: nextOrgsById,
            orgIds: nextOrgIds,
            primaryOrgId: nextPrimaryOrgId,
            membershipsByOrgId: nextMemberships,
          };
        }),

      clearOrgs: () =>
        set(() => ({
          orgsById: {},
          orgIds: [],
          primaryOrgId: null,
          membershipsByOrgId: {},
          status: "idle",
          error: null,
          lastFetchedAt: null,
        })),

      startLoading: () =>
        set(() => ({
          status: "loading",
          error: null,
        })),

      endLoading: () =>
        set(() => ({
          status: "loaded",
          error: null,
        })),

      setError: (message: string) =>
        set(() => ({
          status: "error",
          error: message,
        })),

      setUserOrgMappings: (mappings) =>
        set(() => {
          const membershipsByOrgId: Record<string, UserOrganization> = {};
          for (const m of mappings) {
            const orgId = m.organizationReference;
            membershipsByOrgId[orgId] = m;
          }
          return { membershipsByOrgId };
        }),

      upsertUserOrgMapping: (mapping: UserOrganization) =>
        set((state) => {
          const orgId = mapping.organizationReference;
          return {
            membershipsByOrgId: {
              ...state.membershipsByOrgId,
              [orgId]: mapping,
            },
          };
        }),

      getUserOrgMappingsByOrgId: (orgId) => {
        const { membershipsByOrgId } = get();
        return membershipsByOrgId[orgId] ?? null;
      },

      getCombinedUserOrgByOrgId: (orgId) => {
        const { orgsById, membershipsByOrgId } = get();
        const org = orgsById[orgId];
        if (!org) return null;
        const membership = membershipsByOrgId[orgId] ?? null;
        return { org, membership };
      },
    }),
    {
      name: "org-store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        orgsById: state.orgsById,
        orgIds: state.orgIds,
        primaryOrgId: state.primaryOrgId,
        lastFetchedAt: state.lastFetchedAt,
      }),
      migrate: (persisted, _version) => {
        return persisted as OrgState;
      },
    }
  )
);
