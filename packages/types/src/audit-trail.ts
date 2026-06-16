export type AuditActorType = 'PMS_USER' | 'PARENT' | 'SYSTEM';

export type AuditEntityType =
  | 'COMPANION_ORGANISATION'
  | 'APPOINTMENT'
  | 'INVOICE'
  | 'DOCUMENT'
  | 'FORM'
  | 'TASK';

export type AuditEventType =
  | 'COMPANION_ORG_LINK_CREATED'
  | 'COMPANION_ORG_LINK_REQUESTED'
  | 'COMPANION_ORG_LINK_APPROVED'
  | 'COMPANION_ORG_LINK_REJECTED'
  | 'COMPANION_ORG_LINK_REVOKED'
  | 'COMPANION_ORG_INVITE_ACCEPTED'
  | 'COMPANION_ORG_INVITE_REJECTED'
  | 'COMPANION_ORG_LINK_AUTO'
  | 'APPOINTMENT_REQUESTED'
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_APPROVED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'APPOINTMENT_CHECKED_IN'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_PAID'
  | 'INVOICE_FAILED'
  | 'INVOICE_REFUNDED'
  | 'INVOICE_CANCELLED'
  | 'DOCUMENT_ADDED'
  | 'DOCUMENT_UPDATED'
  | 'DOCUMENT_DELETED'
  | 'FORM_ATTACHED'
  | 'FORM_SUBMITTED'
  | 'TASK_CREATED'
  | 'TASK_REASSIGNED'
  | 'TASK_STATUS_CHANGED';

export interface AuditTrailEntry {
  id: string;
  organisationId: string;
  companionId: string;
  eventType: AuditEventType;
  actorType?: AuditActorType;
  actorId?: string | null;
  actorName?: string | null;
  entityType?: AuditEntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}
