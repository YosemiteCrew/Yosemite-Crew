import {
  getAuditActorLabel,
  getAuditEventLabel,
  getAuditRecordLabel,
} from '@/app/features/audit/auditPresentation';

describe('audit presentation labels', () => {
  it('uses plain-language labels for common events and record types', () => {
    expect(getAuditEventLabel('APPOINTMENT_CREATED')).toBe('Appointment booked');
    expect(getAuditRecordLabel('TASK')).toBe('Task');
    expect(getAuditActorLabel(' Avery ', 'PMS_USER')).toBe('Avery');
  });

  it.each([
    ['PMS_USER', 'Team member'],
    ['PARENT', 'Pet parent'],
    ['SYSTEM', 'System'],
    [null, 'Unknown'],
  ])('labels actor type %s as %s', (actorType, label) => {
    expect(getAuditActorLabel(null, actorType)).toBe(label);
  });

  it.each([
    ['TASK_STATUS_CHANGED', 'Task updated'],
    ['APPOINTMENT_RESCHEDULED_LATE', 'Appointment updated'],
    ['INVOICE_DISCOUNT_ADDED', 'Billing record updated'],
    ['DOCUMENT_SHARED', 'Document updated'],
    ['FORM_ARCHIVED', 'Form updated'],
    ['ENCOUNTER_DISCHARGE_OVERRIDDEN', 'Visit record updated'],
    ['WAITLIST_ENTRY_BOOKED', 'Appointment waitlist updated'],
    ['INSURANCE_CLAIM_CREATED', 'Insurance claim updated'],
    ['REFERRAL_LETTER_SENT', 'Referral updated'],
    ['CARE_REMINDER_SENT', 'Care plan updated'],
    ['PROBLEM_RESOLVED', 'Patient problem updated'],
    ['ALLERGY_RECORDED', 'Patient allergy updated'],
    ['MAR_ENTRY_ADMINISTERED', 'Medication activity recorded'],
    ['SURGERY_RECORDED', 'Surgery record updated'],
    ['CONSENT_GRANTED', 'Consent updated'],
    ['DISCHARGE_INSTRUCTIONS_SENT', 'Discharge record updated'],
    ['DIAGNOSTIC_IMAGE_REVIEWED', 'Diagnostic record updated'],
    ['TRANSFUSION_RECORDED', 'Transfusion record updated'],
    ['FLUID_PLAN_UPDATED', 'Fluid plan updated'],
    ['NUTRITION_PLAN_UPDATED', 'Nutrition plan updated'],
    ['PATIENT_ORG_LINK_CREATED', 'Patient practice access updated'],
    ['UNRECOGNIZED_EVENT', 'Practice activity recorded'],
  ])('labels %s as %s', (eventType, label) => {
    expect(getAuditEventLabel(eventType)).toBe(label);
  });

  it.each([
    ['APPOINTMENT', 'Appointment'],
    ['ENCOUNTER', 'Visit'],
    ['INVOICE', 'Invoice'],
    ['DOCUMENT', 'Document'],
    ['FORM', 'Form'],
    ['TASK', 'Task'],
    ['PATIENT_ORGANISATION', 'Patient practice access'],
    ['PARENT', 'Client profile'],
    ['COMPANION', 'Patient profile'],
    [null, 'Record'],
    ['UNRECOGNIZED_ENTITY', 'Record'],
  ])('labels record type %s as %s', (entityType, label) => {
    expect(getAuditRecordLabel(entityType)).toBe(label);
  });
});
