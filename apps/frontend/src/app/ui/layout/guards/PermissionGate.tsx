import React from 'react';
import { usePermissions } from '@/app/hooks/usePermissions';
import type { Permission } from '@/app/lib/permissions';
import PermissionDeniedState from '@/app/ui/layout/states/PermissionDeniedState';

type PermissionGateProps = {
  anyOf?: Permission[];
  allOf?: Permission[];
  fallback?: React.ReactNode;
  skeleton?: React.ReactNode;
  orgId?: string | null;
  /**
   * When set and no explicit `fallback` is provided, a denied check renders the
   * standard PermissionDeniedState bound to the real role + this resource label
   * (e.g. "Finance"). `deniedDetail` refines the "can't view …" clause.
   */
  deniedResource?: string;
  deniedDetail?: string;
  children: React.ReactNode;
};

export const PermissionGate: React.FC<PermissionGateProps> = ({
  anyOf,
  allOf,
  fallback,
  skeleton = null,
  orgId,
  deniedResource,
  deniedDetail,
  children,
}) => {
  const { can, isLoading } = usePermissions(orgId);

  if (isLoading) return <>{skeleton}</>;

  const allowed = can({ anyOf, allOf });

  if (!allowed) {
    if (fallback !== undefined) return <>{fallback}</>;
    if (deniedResource !== undefined) {
      return (
        <PermissionDeniedState resource={deniedResource} detail={deniedDetail} orgId={orgId} />
      );
    }
    return null;
  }

  return <>{children}</>;
};

export default PermissionGate;
