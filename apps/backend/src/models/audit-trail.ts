import { Schema, model, HydratedDocument } from "mongoose";

export type AuditActorType = "PMS_USER" | "PARENT" | "SYSTEM";

export type AuditEntityType =
  | "COMPANION_ORGANISATION"
  | "APPOINTMENT"
  | "INVOICE"
  | "DOCUMENT"
  | "FORM";

export type AuditEventType =
  | "COMPANION_ORG_LINK_CREATED"
  | "COMPANION_ORG_LINK_REQUESTED"
  | "COMPANION_ORG_LINK_APPROVED"
  | "COMPANION_ORG_LINK_REJECTED"
  | "COMPANION_ORG_LINK_REVOKED"
  | "COMPANION_ORG_INVITE_ACCEPTED"
  | "COMPANION_ORG_INVITE_REJECTED"
  | "COMPANION_ORG_LINK_AUTO"
  | "APPOINTMENT_REQUESTED"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_APPROVED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_CHECKED_IN"
  | "INVOICE_CREATED"
  | "INVOICE_UPDATED"
  | "INVOICE_PAID"
  | "INVOICE_FAILED"
  | "INVOICE_REFUNDED"
  | "INVOICE_CANCELLED"
  | "DOCUMENT_ADDED"
  | "DOCUMENT_UPDATED"
  | "DOCUMENT_DELETED"
  | "FORM_ATTACHED"
  | "FORM_SUBMITTED";

export interface AuditTrailMongo {
  organisationId: string;
  companionId: string;
  eventType: AuditEventType;

  actorType?: AuditActorType;
  actorId?: string | null;
  actorName?: string | null;

  entityType?: AuditEntityType;
  entityId?: string | null;

  metadata?: Record<string, unknown>;
  occurredAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AuditTrailSchema = new Schema<AuditTrailMongo>(
  {
    organisationId: { type: String, required: true, index: true },
    companionId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },

    actorType: {
      type: String,
      enum: ["PMS_USER", "PARENT", "SYSTEM"],
      default: null,
    },
    actorId: { type: String, default: null },
    actorName: { type: String, default: null },

    entityType: {
      type: String,
      enum: ["COMPANION_ORGANISATION", "APPOINTMENT", "INVOICE", "DOCUMENT", "FORM"],
      default: null,
    },
    entityId: { type: String, default: null },

    metadata: { type: Schema.Types.Mixed, default: null },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

AuditTrailSchema.index({ organisationId: 1, companionId: 1, occurredAt: -1 });
AuditTrailSchema.index({ organisationId: 1, occurredAt: -1 });

export type AuditTrailDocument = HydratedDocument<AuditTrailMongo>;

const AuditTrailModel = model<AuditTrailMongo>("AuditTrail", AuditTrailSchema);

export default AuditTrailModel;
