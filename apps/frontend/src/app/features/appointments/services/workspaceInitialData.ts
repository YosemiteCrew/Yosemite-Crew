import type {
  AppointmentEncounter,
  EncounterMode,
  ObservationToolDefinition,
  WorkspaceStep,
} from '@/app/features/appointments/types/workspace';

const EMPTY_STEP_STATUS: Record<WorkspaceStep, 'EMPTY'> = {
  SOAP: 'EMPTY',
  DIAGNOSTICS: 'EMPTY',
  TREATMENT: 'EMPTY',
  INVOICE: 'EMPTY',
  SUMMARY: 'EMPTY',
};

export const OBSERVATION_TOOLS: ObservationToolDefinition[] = [
  {
    key: 'FGS',
    name: 'Feline grimace scale',
    intro:
      'The Feline Grimace Scale (FGS) (© Université de Montréal 2019) is a valid, fast, reliable and easy-to-use tool that can help with pain assessment in cats. The FGS Scale can help veterinary surgeons with clinical decisions in pain management, and determine if the administration of analgesics (i.e. pain killers) is required.',
  },
  {
    key: 'CSU_CAP',
    name: 'Canine acute pain scale',
    intro:
      'The Colorado State University Canine Acute Pain Scale (CSU-CAP) (© 2006/PW Hellyer, SR Uhrig, NG Robinson) is a simple to use tool for the assessment and monitoring of acute pain in dogs. The CSU-CAP helps veterinary professionals with clinical decisions in pain management and to determine if the administration of analgesics is required.',
  },
];

/** Build an empty production encounter shell; sections are hydrated from APIs. */
export const buildEmptyEncounter = (
  appointmentId: string,
  mode: EncounterMode
): AppointmentEncounter => ({
  appointmentId,
  mode,
  consultationType: mode === 'INPATIENT' ? 'Inpatient' : 'Outpatient',
  leadId: undefined,
  leadName: undefined,
  nurseId: undefined,
  nurseName: undefined,
  alerts: [],
  soap: [],
  soapTemplates: [],
  vitals: [],
  observations: [],
  diagnosticTests: [],
  diagnosticOrders: [],
  services: [],
  prescription: [],
  schedule: [],
  roomId: undefined,
  unitId: undefined,
  invoiceLineItems: [],
  pastInvoices: [],
  depositCents: 0,
  // Pre-hydration placeholder only: a valid ISO-4217 code is required because
  // money.ts (Intl.NumberFormat) throws on empty/invalid codes. The server's
  // org-derived currency always wins once billing is hydrated into the store
  // (see appointmentWorkspaceStore: `currency: billing.currency ?? enc.currency`).
  currency: 'USD',
  withdrawDeposit: false,
  taxPercent: 0,
  overallDiscountPercent: 0,
  dischargeSummary: '',
  followUpAt: undefined,
  documents: [],
  readyForBilling: { value: false },
  readyForDischarge: { value: false },
  stepStatus: { ...EMPTY_STEP_STATUS },
  lockedAt: undefined,
  viewOnly: false,
});
