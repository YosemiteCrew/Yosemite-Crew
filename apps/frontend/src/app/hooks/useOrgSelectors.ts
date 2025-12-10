import { useMemo } from "react";
import { useOrgStore } from "../stores/orgStore";
import { Organisation, UserOrganization } from "@yosemite-crew/types";
import { OrgWithMembership } from "../types/org";

export const useOrgList = (): Organisation[] => {
  const orgIds = useOrgStore((s) => s.orgIds);
  const orgsById = useOrgStore((s) => s.orgsById);

  return useMemo(() => {
    const list: Organisation[] = [];
    for (const orgId of orgIds) {
      const org: Organisation | undefined = orgsById[orgId];
      if (!org) continue;
      list.push(org);
    }
    return list;
  }, [orgIds, orgsById]);
};

export const useOrgWithMemberships = (): OrgWithMembership[] => {
  const orgIds = useOrgStore((s) => s.orgIds);
  const orgsById = useOrgStore((s) => s.orgsById);
  const membershipsByOrgId = useOrgStore((s) => s.membershipsByOrgId);

  return useMemo(() => {
    const list: OrgWithMembership[] = [];

    for (const orgId of orgIds) {
      const org = orgsById[orgId];
      if (!org) continue;

      const membership = membershipsByOrgId[orgId] ?? null;

      list.push({ org, membership });
    }

    return list;
  }, [orgIds, orgsById, membershipsByOrgId]);
};

export const usePrimaryOrg = (): Organisation | null => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const orgsById = useOrgStore((s) => s.orgsById);

  return useMemo(() => {
    if (!primaryOrgId) return null;
    return orgsById[primaryOrgId] ?? null;
  }, [primaryOrgId, orgsById]);
};

export const usePrimaryOrgWithMembership = (): {
  org: Organisation | null;
  membership: UserOrganization | null;
} => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const orgsById = useOrgStore((s) => s.orgsById);
  const membershipsByOrgId = useOrgStore((s) => s.membershipsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) {
      return { org: null, membership: null };
    }

    const org = orgsById[primaryOrgId] ?? null;
    const membership = membershipsByOrgId[primaryOrgId] ?? null;

    return { org, membership };
  }, [primaryOrgId, orgsById, membershipsByOrgId]);
};
