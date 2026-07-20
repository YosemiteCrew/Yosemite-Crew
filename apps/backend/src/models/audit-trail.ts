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

export interface AuditTrailDocument extends AuditTrailMongo {
  _id: string;
}
