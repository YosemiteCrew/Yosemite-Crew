export type ParentCompanionRole = "PRIMARY" | "CO_PARENT";

export type ParentCompanionStatus = "ACTIVE" | "PENDING" | "REVOKED";

export interface ParentCompanionPermissions {
  assignAsPrimaryParent: boolean;
  emergencyBasedPermissions: boolean;
  appointments: boolean;
  companionProfile: boolean;
  documents: boolean;
  expenses: boolean;
  tasks: boolean;
  chatWithVet: boolean;
}

export interface CompanionParentLink {
  parentId: string;
  role: ParentCompanionRole;
  status: ParentCompanionStatus;
  permissions: ParentCompanionPermissions;
  invitedByParentId?: string;
  acceptedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
