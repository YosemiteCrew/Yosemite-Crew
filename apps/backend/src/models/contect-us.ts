import { Schema, model, HydratedDocument } from "mongoose";

export type ContactType =
  | "GENERAL_ENQUIRY"
  | "FEATURE_REQUEST"
  | "DSAR"
  | "COMPLAINT";

export type ContactSource = "MOBILE_APP" | "PMS_WEB" | "MARKETING_SITE";

export type ContactStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type DsraRequesterType = "SELF" | "PARENT_GUARDIAN" | "AUTHORIZED_AGENT";

export type DsraLawBasis = "GDPR" | "CCPA" | "UK_GDPR" | "LGPD" | "PIPEDA" | "POPIA" | "PDPA" | "PIPL" | "PA_1988_AU" |"OTHER";

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

const AttachmentSchema = new Schema<ContactAttachment>(
  {
    id: String,
    url: { type: String, required: true },
    name: { type: String, required: true },
    contentType: String,
    sizeBytes: Number,
  },
  { _id: false },
);

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

const DsraSchema = new Schema<DsraDetails>(
  {
    requesterType: {
      type: String,
      enum: ["SELF", "PARENT_GUARDIAN", "AUTHORIZED_AGENT"],
      required: true,
    },
    lawBasis: {
      type: String,
      enum: ["GDPR", "CCPA", "UK_GDPR", "OTHER"],
    },
    otherLawText: String,
    rightsRequested: {
      type: [String],
      enum: [
        "KNOW_INFORMATION_COLLECTED",
        "ACCESS_PERSONAL_INFORMATION",
        "DELETE_DATA",
        "RECTIFY_INACCURATE_INFORMATION",
        "RESTRICT_PROCESSING",
        "PORTABILITY_COPY",
        "OPT_OUT_SELLING_SHARING",
        "LIMIT_SENSITIVE_PROCESSING",
        "OTHER",
      ],
      default: [],
    },
    otherRightText: String,
    dataSubjectDescription: String,
    declarationAccepted: { type: Boolean, default: false },
    declarationAcceptedAt: Date,
  },
  { _id: false },
);

export type ContactPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ContactCategory =
  | 'GENERAL_ENQUIRY'
  | 'TECHNICAL'
  | 'BILLING'
  | 'FEATURE_REQUEST'
  | 'DSAR'
  | 'COMPLAINT';

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
  fullName?: string;
  phone?: string;

  // domain context
  organisationId?: string;
  companionId?: string;
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
  priority: ContactPriority;
  assigneeId?: string | null;
  assigneeName?: string | null;
  category: ContactCategory;
  internalNotes?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

const ContactRequestSchema = new Schema<ContactRequestMongo>(
  {
    type: {
      type: String,
      enum: ["GENERAL_ENQUIRY", "FEATURE_REQUEST", "DSAR", "COMPLAINT"],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["MOBILE_APP", "PMS_WEB", "MARKETING_SITE"],
      required: true,
    },

    subject: { type: String, required: true },
    message: { type: String, required: true },
    fullName: { type: String },
    phone: { type: String },

    userId: { type: String, index: true },
    email: { type: String },

    organisationId: { type: String, index: true },
    companionId: { type: String, index: true },
    parentId: { type: String, index: true },

    dsarDetails: { type: DsraSchema, required: false },

    complaintContext: {
      aboutOrganisationId: String,
      aboutAppointmentId: String,
    },

    attachments: { type: [AttachmentSchema], default: [] },

    fullName: { type: String },
    phone: { type: String },

    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
    },
    assigneeId: { type: String, default: null },
    assigneeName: { type: String, default: null },
    category: {
      type: String,
      enum: [
        "GENERAL_ENQUIRY",
        "TECHNICAL",
        "BILLING",
        "FEATURE_REQUEST",
        "DSAR",
        "COMPLAINT",
      ],
      default: "GENERAL_ENQUIRY",
    },
    internalNotes: String,
  },
  { timestamps: true },
);

export type ContactRequestDocument = HydratedDocument<ContactRequestMongo>;

const ContactRequestModel = model<ContactRequestMongo>(
  "ContactRequest",
  ContactRequestSchema,
);

export default ContactRequestModel;
