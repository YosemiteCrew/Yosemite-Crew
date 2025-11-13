import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Org = {
  id: string;
  name: string;
  imageURL?: string | null;
  phoneNo?: string | null;
  country?: string | null;
  website?: string | null;
  isVerified: boolean;
};

type OrgState = {
  orgs: Org[];
  _index: Record<string, number>;
  primaryOrgId: string | null;
  setOrgs: (orgs: Org[], opts?: { keepPrimaryIfPresent?: boolean }) => void;
  upsertOrg: (org: Org) => void;
  removeOrg: (orgId: string) => void;
  clearOrgs: () => void;
  setPrimaryOrg: (orgId: string | null) => void;
  getOrgById: (orgId: string) => Org | null;
  getPrimaryOrg: () => Org | null;
};

const buildIndex = (orgs: Org[]): Record<string, number> => {
  const idx: Record<string, number> = {};
  for (let i = 0; i < orgs.length; i++) idx[orgs[i].id] = i;
  return idx;
};

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      orgs: [],
      _index: {},
      primaryOrgId: null,
      setOrgs: (orgs, opts) => {
        const keep = opts?.keepPrimaryIfPresent ?? true;
        const currentPrimary = get().primaryOrgId;
        const nextOrgs = [...orgs];
        const nextIndex = buildIndex(nextOrgs);
        let nextPrimary: string | null = null;
        if (keep && currentPrimary && nextIndex[currentPrimary] !== undefined) {
          nextPrimary = currentPrimary;
        } else {
          nextPrimary = nextOrgs[0]?.id ?? null;
        }
        set({ orgs: nextOrgs, _index: nextIndex, primaryOrgId: nextPrimary });
      },
      upsertOrg: (org) => {
        const { orgs, _index, primaryOrgId } = get();
        const pos = _index[org.id];
        if (pos === undefined) {
          const nextOrgs = [...orgs, org];
          set({
            orgs: nextOrgs,
            _index: buildIndex(nextOrgs),
            primaryOrgId: primaryOrgId ?? org.id,
          });
          return;
        }
        const nextOrgs = [...orgs];
        nextOrgs[pos] = { ...nextOrgs[pos], ...org };
        set({ orgs: nextOrgs, _index: _index });
      },
      removeOrg: (orgId) => {
        const { orgs, primaryOrgId } = get();
        const nextOrgs = orgs.filter((o) => o.id !== orgId);
        const nextIndex = buildIndex(nextOrgs);
        let nextPrimary = primaryOrgId;
        if (primaryOrgId === orgId) {
          nextPrimary = nextOrgs[0]?.id ?? null;
        }
        set({ orgs: nextOrgs, _index: nextIndex, primaryOrgId: nextPrimary });
      },
      clearOrgs: () => set({ orgs: [], _index: {}, primaryOrgId: null }),
      setPrimaryOrg: (orgId) => {
        if (orgId === null) return set({ primaryOrgId: null });
        const exists = get()._index[orgId] !== undefined;
        if (!exists) return;
        set({ primaryOrgId: orgId });
      },
      getOrgById: (orgId) => {
        const { orgs, _index } = get();
        const pos = _index[orgId];
        return pos === undefined ? null : (orgs[pos] ?? null);
      },
      getPrimaryOrg: () => {
        const { orgs, primaryOrgId, _index } = get();
        if (!primaryOrgId) return null;
        const pos = _index[primaryOrgId];
        return pos === undefined ? null : (orgs[pos] ?? null);
      },
    }),
    {
      name: "org-store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        orgs: state.orgs,
        primaryOrgId: state.primaryOrgId,
      }),
      migrate: (persisted: any, _version) => {
        if (!persisted) return persisted;
        return {
          ...persisted,
          _index: buildIndex(persisted.orgs ?? []),
        };
      },
    }
  )
);
