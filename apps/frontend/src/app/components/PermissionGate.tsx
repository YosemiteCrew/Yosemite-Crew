import React from "react";
import { usePermissions } from "@/app/hooks/usePermissions";
import type { Permission } from "../utils/permissions";

type PermissionGateProps = {
  anyOf?: Permission[];
  allOf?: Permission[];
  fallback?: React.ReactNode;
  orgId?: string | null;
  children: React.ReactNode;
};

export const PermissionGate: React.FC<PermissionGateProps> = ({
  anyOf,
  allOf,
  fallback = null,
  orgId,
  children,
}) => {
  const { can, isLoading } = usePermissions(orgId);

  if (isLoading) return <>{fallback}</>;

  const allowed = can({ anyOf, allOf });

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
