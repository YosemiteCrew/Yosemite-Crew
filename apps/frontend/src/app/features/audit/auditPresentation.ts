const EVENT_LABELS: Record<string, string> = {
  APPOINTMENT_REQUESTED: 'Appointment requested',
  APPOINTMENT_CREATED: 'Appointment booked',
  APPOINTMENT_APPROVED: 'Appointment approved',
  APPOINTMENT_CANCELLED: 'Appointment cancelled',
  APPOINTMENT_RESCHEDULED: 'Appointment rescheduled',
  APPOINTMENT_CHECKED_IN: 'Patient checked in',
  INVOICE_CREATED: 'Invoice created',
  INVOICE_UPDATED: 'Invoice updated',
  INVOICE_PAID: 'Payment received',
  INVOICE_FAILED: 'Payment failed',
  INVOICE_REFUNDED: 'Payment refunded',
  INVOICE_CANCELLED: 'Invoice cancelled',
  TASK_CREATED: 'Task created',
  TASK_REASSIGNED: 'Task reassigned',
  TASK_STATUS_CHANGED: 'Task updated',
  DOCUMENT_ADDED: 'Document added',
  DOCUMENT_UPDATED: 'Document updated',
  DOCUMENT_DELETED: 'Document removed',
  FORM_ATTACHED: 'Template attached',
  FORM_SUBMITTED: 'Form completed',
  ENCOUNTER_DISCHARGED: 'Visit closed',
  VACCINATION_RECORDED: 'Vaccination recorded',
  EXAM_RECORDED: 'Examination recorded',
  PRACTITIONER_FEEDBACK_SUBMITTED: 'Veterinarian feedback submitted',
  PRACTITIONER_FEEDBACK_UPDATED: 'Veterinarian feedback updated',
};

const EVENT_GROUP_LABELS: Record<string, string> = {
  PATIENT: 'Patient record updated',
  COMPANION: 'Patient record updated',
  PARENT: 'Client record updated',
  ENCOUNTER: 'Visit record updated',
  WAITLIST: 'Appointment waitlist updated',
  INSURANCE: 'Insurance claim updated',
  REFERRAL: 'Referral updated',
  CARE: 'Care plan updated',
  PROBLEM: 'Patient problem updated',
  ALLERGY: 'Patient allergy updated',
  MAR: 'Medication activity recorded',
  SURGERY: 'Surgery record updated',
  CONSENT: 'Consent updated',
  DISCHARGE: 'Discharge record updated',
  DIAGNOSTIC: 'Diagnostic record updated',
  TRANSFUSION: 'Transfusion record updated',
  FLUID: 'Fluid plan updated',
  NUTRITION: 'Nutrition plan updated',
};

export const getAuditEventLabel = (eventType: string): string => {
  const exactLabel = EVENT_LABELS[eventType];
  if (exactLabel) return exactLabel;

  const group = eventType.split('_')[0];
  if (group === 'TASK') return 'Task updated';
  if (group === 'APPOINTMENT') return 'Appointment updated';
  if (group === 'INVOICE') return 'Billing record updated';
  if (group === 'DOCUMENT') return 'Document updated';
  if (group === 'FORM') return 'Form updated';
  if (group === 'PATIENT' && eventType.startsWith('PATIENT_ORG_')) {
    return 'Patient practice access updated';
  }
  return EVENT_GROUP_LABELS[group] ?? 'Practice activity recorded';
};

const RECORD_LABELS: Record<string, string> = {
  APPOINTMENT: 'Appointment',
  ENCOUNTER: 'Visit',
  INVOICE: 'Invoice',
  DOCUMENT: 'Document',
  FORM: 'Form',
  TASK: 'Task',
  PATIENT_ORGANISATION: 'Patient practice access',
  PARENT: 'Client profile',
  COMPANION: 'Patient profile',
};

export const getAuditRecordLabel = (entityType: string | null): string => {
  if (!entityType) return 'Record';
  return RECORD_LABELS[entityType] ?? 'Record';
};

export const getAuditActorLabel = (actorName: string | null, actorType: string | null): string => {
  if (actorName?.trim()) return actorName.trim();
  if (actorType === 'PMS_USER') return 'Team member';
  if (actorType === 'PARENT') return 'Pet parent';
  if (actorType === 'SYSTEM') return 'System';
  return 'Unknown';
};
