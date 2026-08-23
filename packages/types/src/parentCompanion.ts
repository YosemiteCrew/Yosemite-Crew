export type ParentCompanionRole = 'PRIMARY' | 'CO_PARENT';

export type ParentCompanionStatus = 'ACTIVE' | 'PENDING' | 'REVOKED';

export interface ParentCompanionPermissions {
  assignAsPrimaryParent: boolean;
  emergencyBasedPermissions: boolean;
  appointments: boolean;
  companionProfile: boolean;
  documents: boolean;
  expenses: boolean;
  tasks: boolean;
  chatWithVet: boolean;
  /**
   * Attested clinical records - the pet passport and the vaccination,
   * parasite-treatment, rabies-titration and clinical-exam history a vet has
   * signed.
   *
   * Deliberately its own key rather than riding on `companionProfile`. These
   * are signed medical records, so access is granted explicitly and never
   * inherited from a broader permission; a primary parent who shares profile
   * details has not thereby shared the medical history.
   */
  medicalRecords: boolean;
}

export interface CompanionParentLink {
  parent?: ParenDetailsForLink;
  parentId: string;
  role: ParentCompanionRole;
  status: ParentCompanionStatus;
  permissions: ParentCompanionPermissions;
  invitedByParentId?: string;
  acceptedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ParenDetailsForLink {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  profileImageUrl: string;
}
