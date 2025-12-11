import { useMemo, useCallback } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import type { Permission } from "../utils/permissions";

type CanInput =
  | Permission
  | Permission[]
  | {
      anyOf?: Permission[];
      allOf?: Permission[];
    };

export type PermissionCheckResult = {
  permissions: string[];
  canAll: (perms: Permission | Permission[]) => boolean;
  canAny: (perms: Permission | Permission[]) => boolean;
  can: (input: CanInput) => boolean;
  isLoading: boolean;
  activeOrgId: string | null;
};

export const usePermissions = (
  explicitOrgId?: string | null
): PermissionCheckResult => {
  const { primaryOrgId, membershipsByOrgId, status } = useOrgStore((state) => ({
    primaryOrgId: state.primaryOrgId,
    membershipsByOrgId: state.membershipsByOrgId,
    status: state.status,
  }));

  const activeOrgId = explicitOrgId ?? primaryOrgId ?? null;

  const permissions = useMemo<string[]>(() => {
    if (!activeOrgId) return [];
    const membership = membershipsByOrgId[activeOrgId];
    return membership?.effectivePermissions ?? [];
  }, [activeOrgId, membershipsByOrgId]);

  const hasPermission = useCallback(
    (perm: Permission) => {
      return permissions.includes(perm);
    },
    [permissions]
  );

  const canAll = useCallback(
    (perms: Permission | Permission[]) => {
      const list = Array.isArray(perms) ? perms : [perms];
      if (!list.length) return false;
      return list.every((perm) => hasPermission(perm));
    },
    [hasPermission]
  );

  const canAny = useCallback(
    (perms: Permission | Permission[]) => {
      const list = Array.isArray(perms) ? perms : [perms];
      if (!list.length) return false;
      return list.some((perm) => hasPermission(perm));
    },
    [hasPermission]
  );

  const can = useCallback(
    (input: CanInput): boolean => {
      if (typeof input === "string") {
        return hasPermission(input);
      }
      if (Array.isArray(input)) {
        return canAll(input);
      }
      const { anyOf, allOf } = input;

      if (anyOf?.length && !canAny(anyOf)) {
        return false;
      }

      if (allOf?.length && !canAll(allOf)) {
        return false;
      }
      if (!anyOf?.length && !allOf?.length) {
        return false;
      }
      return true;
    },
    [hasPermission, canAll, canAny]
  );

  const isLoading = status === "loading";

  return {
    permissions,
    canAll,
    canAny,
    can,
    isLoading,
    activeOrgId,
  };
};

export const useHasPermission = (perm: Permission | Permission[]) => {
  const { can } = usePermissions();
  return can(perm);
};
