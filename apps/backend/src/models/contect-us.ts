export type ContactType =
  "GENERAL_ENQUIRY" | "FEATURE_REQUEST" | "DSAR" | "COMPLAINT";

export type ContactSource = "MOBILE_APP" | "PMS_WEB" | "MARKETING_SITE";

export type ContactStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type DsraRequesterType = "SELF" | "PARENT_GUARDIAN" | "AUTHORIZED_AGENT";

export type DsraLawBasis =
  | "GDPR"
  | "CCPA"
  | "UK_GDPR"
  | "LGPD"
  | "PIPEDA"
  | "POPIA"
  | "PDPA"
  | "PIPL"
  | "PA_1988_AU"
  | "OTHER";

export type DsraRight =
  | "KNOW_INFORMATION_COLLECTED"
  | "ACCESS_PERSONAL_INFORMATION"
  | "DELETE_DATA"
  | "RECTIFY_INACCURATE_INFORMATION"
  | "RESTRICT_PROCESSING"
  | "PORTABILITY_COPY"
  | "OPT_OUT_SELLING_SHARING"
  | "LIMIT_SENSITIVE_PROCESSING"
  | "OTHER";

export interface ContactAttachment {
  id?: string; // internal file id if you have a file service
  url: string; // S3 / GCS URL
  name: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface DsraDetails {
  requesterType: DsraRequesterType;
  lawBasis?: DsraLawBasis;
  otherLawText?: string;

  rightsRequested: DsraRight[];
  otherRightText?: string;

  // text from “You are submitting this request as…”
  dataSubjectDescription?: string;

  declarationAccepted: boolean;
  declarationAcceptedAt?: Date;
}

export interface ContactRequestMongo {
  type: ContactType;
  source: ContactSource;

  subject: string;
  message: string;
  fullName?: string;
  phone?: string;

  // who is talking, optional depending on whether user is logged in
  userId?: string;
  email?: string;

  // domain context
  organisationId?: string;
  patientId?: string;
  parentId?: string;

  // DSAR-specific
  dsarDetails?: DsraDetails;

  // Complaint-specific extra fields (optional; extend later)
  complaintContext?: {
    aboutOrganisationId?: string;
    aboutAppointmentId?: string;
  };

  attachments?: ContactAttachment[];

  status: ContactStatus;
  internalNotes?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface ContactRequestDocument extends ContactRequestMongo {
  _id: string;
}
