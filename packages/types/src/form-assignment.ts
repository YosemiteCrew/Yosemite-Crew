export type FormAssignmentStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'submitted'
  | 'signed'
  | 'expired'
  | 'cancelled';

export interface FormSignerIdentity {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface FormAssignmentLike {
  assignmentId: string;
  id: string;
  organisationId: string;
  templateId: string;
  templateVersion: number;
  appointmentId: string | null;
  encounterId: string | null;
  companionId: string | null;
  signerUserId: string | null;
  signerName: string | null;
  signerEmail: string | null;
  signerRole: string | null;
  mobileVisible: boolean;
  signingRequired: boolean;
  status: FormAssignmentStatus;
  sentAt: Date | null;
  viewedAt: Date | null;
  submittedAt: Date | null;
  signedAt: Date | null;
  expiredAt: Date | null;
  cancelledAt: Date | null;
  signerIdentity: FormSignerIdentity | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormAssignmentCreateInput {
  organisationId: string;
  templateId: string;
  templateVersion?: number;
  appointmentId: string;
  companionId?: string;
  signerIdentity?: FormSignerIdentity;
  mobileVisible?: boolean;
  signingRequired?: boolean;
  createdBy: string;
}
