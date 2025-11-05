// Co-Parent related types
export interface CoParent {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  profilePicture?: string;
  profileToken?: string;
  companions: CompanionCoParent[];
  permissions: CoParentPermissions;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
}

export interface CompanionCoParent {
  companionId: string;
  companionName: string;
  breed?: string;
  profileImage?: string;
  hasPermission: boolean;
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
  companionIds?: string[];
}

export interface CoParentState {
  coParents: CoParent[];
  loading: boolean;
  error: string | null;
  selectedCoParentId: string | null;
}
