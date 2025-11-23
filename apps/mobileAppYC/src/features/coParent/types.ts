export type ParentRole = 'PRIMARY' | 'CO-PARENT' | 'PRIMARY_PARENT';

export interface CompanionCoParent {
  companionId: string;
  companionName: string;
  breed?: string;
  profileImage?: string;
  hasPermission: boolean;
}

export interface CoParent {
  id: string;
  parentId: string;
  userId?: string;
  companionId: string;
  role: ParentRole;
  status: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profilePicture?: string;
  profileToken?: string;
  companions: CompanionCoParent[];
  permissions: CoParentPermissions;
  createdAt?: string;
  updatedAt?: string;
}

export interface CoParentPermissions {
  assignAsPrimaryParent: boolean;
  emergencyBasedPermissions: boolean;
  appointments: boolean;
  companionProfile: boolean;
  documents: boolean;
  expenses: boolean;
  tasks: boolean;
  chatWithVet: boolean;
}

export interface CoParentInviteRequest {
  candidateName: string;
  email: string;
  phoneNumber?: string;
  companionId: string;
}

export interface PendingCoParentInvite {
  token: string;
  email: string;
  inviteeName: string;
  expiresAt: string;
  invitedBy?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    profileImageUrl?: string;
  };
  companion?: {
    id?: string;
    name?: string;
    photoUrl?: string;
  };
}

export interface ParentCompanionAccess {
  companionId?: string;
  parentId: string;
  role: ParentRole;
  status?: string;
  permissions: CoParentPermissions;
}

export interface CoParentState {
  coParents: CoParent[];
  pendingInvites: PendingCoParentInvite[];
  accessByCompanionId: Record<string, ParentCompanionAccess>;
  defaultAccess?: ParentCompanionAccess | null;
  lastFetchedRole?: ParentRole | null;
  lastFetchedPermissions?: CoParentPermissions | null;
  loading: boolean;
  invitesLoading: boolean;
  accessLoading: boolean;
  error: string | null;
  selectedCoParentId: string | null;
}
