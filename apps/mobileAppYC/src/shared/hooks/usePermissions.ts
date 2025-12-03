import {useMemo, useCallback} from 'react';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import type {CoParentPermissions, ParentCompanionAccess} from '@/features/coParent';

const EMPTY_ACCESS_MAP: Record<string, ParentCompanionAccess> = {};

/**
 * Hook for managing appointment-specific permissions
 * Provides unified access to permission checking across screens
 */
export const usePermissions = (selectedCompanionId?: string | null) => {
  const accessMap = useSelector(
    (state: RootState) => state.coParent?.accessByCompanionId ?? EMPTY_ACCESS_MAP,
  );
  const defaultAccess = useSelector((state: RootState) => state.coParent?.defaultAccess ?? null);
  const globalRole = useSelector((state: RootState) => state.coParent?.lastFetchedRole);
  const globalPermissions = useSelector((state: RootState) => state.coParent?.lastFetchedPermissions);

  const accessForCompanion = useMemo(
    () =>
      selectedCompanionId
        ? accessMap[selectedCompanionId] ?? defaultAccess ?? null
        : defaultAccess,
    [selectedCompanionId, accessMap, defaultAccess],
  );

  const role = useMemo(
    () => (accessForCompanion?.role ?? defaultAccess?.role ?? globalRole ?? '').toUpperCase(),
    [accessForCompanion, defaultAccess, globalRole],
  );

  const permissions = useMemo(
    () => accessForCompanion?.permissions ?? defaultAccess?.permissions ?? globalPermissions,
    [accessForCompanion, defaultAccess, globalPermissions],
  );

  const isPrimary = useMemo(() => role.includes('PRIMARY'), [role]);

  const canUseAppointments = useMemo(
    () => isPrimary || Boolean(permissions?.appointments),
    [isPrimary, permissions],
  );

  const canUseChat = useMemo(
    () => isPrimary || Boolean(permissions?.chatWithVet),
    [isPrimary, permissions],
  );

  const canUseTasks = useMemo(
    () => isPrimary || Boolean(permissions?.tasks),
    [isPrimary, permissions],
  );

  const canUseEmergency = useMemo(
    () => isPrimary || Boolean(permissions?.emergencyBasedPermissions),
    [isPrimary, permissions],
  );

  const checkPermission = useCallback(
    (permission: keyof CoParentPermissions): boolean => {
      if (isPrimary) return true;
      if (!permissions) return false;
      return Boolean(permissions[permission]);
    },
    [isPrimary, permissions],
  );

  return {
    accessForCompanion,
    role,
    permissions,
    isPrimary,
    canUseAppointments,
    canUseChat,
    canUseTasks,
    canUseEmergency,
    checkPermission,
  };
};
