import { Schema, model, HydratedDocument } from "mongoose";

export type AuditActorType = "PMS_USER" | "PARENT" | "SYSTEM";

export type AuditEntityType =
  | "PATIENT_ORGANISATION"
  | "APPOINTMENT"
  | "ENCOUNTER"
  | "INVOICE"
  | "DOCUMENT"
  | "FORM"
  | "TASK"
  | "PARENT"
  | "COMPANION";

export type AuditEventType =
  | "PATIENT_ORG_LINK_CREATED"
  | "PATIENT_ORG_LINK_REQUESTED"
  | "PATIENT_ORG_LINK_APPROVED"
  | "PATIENT_ORG_LINK_REJECTED"
  | "PATIENT_ORG_LINK_REVOKED"
  | "PATIENT_ORG_INVITE_ACCEPTED"
  | "PATIENT_ORG_INVITE_REJECTED"
  | "PATIENT_ORG_LINK_AUTO"
  | "APPOINTMENT_REQUESTED"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_APPROVED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_CHECKED_IN"
  | "ENCOUNTER_DISCHARGE_OVERRIDDEN"
  | "ENCOUNTER_DISCHARGED"
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
  | "FORM_SUBMITTED"
  | "TASK_CREATED"
  | "TASK_REASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "PARENT_ALERT_CREATED"
  | "PARENT_ALERT_UPDATED"
  | "PARENT_ALERT_DELETED"
  | "COMPANION_ALERT_CREATED"
  | "COMPANION_ALERT_UPDATED"
  | "COMPANION_ALERT_DELETED";

export interface AuditTrailMongo {
  organisationId: string;
  patientId: string;
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

const AuditTrailSchema = new Schema(
  {
    organisationId: { type: String, required: true, index: true },
    patientId: { type: String, required: true, index: true },
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
      enum: [
        "PATIENT_ORGANISATION",
        "APPOINTMENT",
        "ENCOUNTER",
        "INVOICE",
        "DOCUMENT",
        "FORM",
        "TASK",
        "PARENT",
        "COMPANION",
      ],
      default: null,
    },
    entityId: { type: String, default: null },

    metadata: { type: Schema.Types.Mixed, default: null },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

AuditTrailSchema.index({ organisationId: 1, patientId: 1, occurredAt: -1 });
AuditTrailSchema.index({ organisationId: 1, occurredAt: -1 });

export type AuditTrailDocument = HydratedDocument<AuditTrailMongo>;

const AuditTrailModel = model<AuditTrailMongo>("AuditTrail", AuditTrailSchema);

export default AuditTrailModel;
