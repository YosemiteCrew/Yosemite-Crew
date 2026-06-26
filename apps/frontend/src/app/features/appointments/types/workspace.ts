import type { FormField } from '@/app/features/forms/types/forms';

/** The five workspace steps, in order. */
export type WorkspaceStep = 'SOAP' | 'DIAGNOSTICS' | 'TREATMENT' | 'INVOICE' | 'SUMMARY';

export const WORKSPACE_STEPS: WorkspaceStep[] = [
  'SOAP',
  'DIAGNOSTICS',
  'TREATMENT',
  'INVOICE',
  'SUMMARY',
];

export const WORKSPACE_STEP_LABELS: Record<WorkspaceStep, string> = {
  SOAP: 'SOAP Notes',
  DIAGNOSTICS: 'Diagnostics',
  TREATMENT: 'Treatment',
  INVOICE: 'Invoice',
  SUMMARY: 'Summary',
};

export type StepStatus = 'EMPTY' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED';

export type EncounterMode = 'OUTPATIENT' | 'INPATIENT';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type CompanionAlert = {
  id: string;
  label: string;
  severity: AlertSeverity;
};

/** A green "ready" stamp records who toggled it and when. */
export type ReadyState = {
  value: boolean;
  byUserId?: string;
  byName?: string;
  at?: string;
};

export type SoapNoteEntry = {
  id: string;
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  templateId?: string;
  /** Backend template version that prefilled this note (provenance for the saved artifact). */
  templateVersion?: number;
  /** Backend template version id (full provenance, mirrors the discharge artifact). */
  templateVersionId?: string;
  /**
   * When a CUSTOM (non-native) SOAP template is selected, its structure replaces the four
   * native S/O/A/P editors. `customSchema` holds the template's typed fields and
   * `customAnswers` holds the per-field answers (keyed by field id). Both are persisted to /
   * rehydrated from the clinical-artifact `metadata` channel so the override survives refresh.
   */
  customSchema?: FormField[];
  customAnswers?: Record<string, unknown>;
  signedByName?: string;
  signedAt?: string;
  signedOffline?: boolean;
  status: StepStatus;
  createdAt: string;
};

export type SoapTemplate = {
  id: string;
  name: string;
  serviceId?: string;
  isDefault?: boolean;
  /**
   * Backend template version, stamped onto the SOAP draft as provenance when the
   * template is applied (`templateVersion`). Carried from the resolver/list so the
   * saved note records exactly which template version prefilled it.
   */
  version?: number;
  /** Backend template version id (full provenance, carried onto the saved artifact). */
  versionId?: string;
  /**
   * When set, this template is CUSTOM (its structure differs from the native four S/O/A/P
   * sections). Selecting it swaps the workspace SOAP structure: the typed fields render via
   * the shared FormRenderer instead of the four rich-text editors. Derived from the template's
   * schema snapshot. Native (YC-default) templates leave this undefined and only swap content.
   */
  customSchema?: FormField[];
  /**
   * Section content the template prefills into the SOAP editors. Populated from the
   * template's schema snapshot (via the resolver or list). When present, applying
   * the template hydrates the matching S/O/A/P editors instead of only setting an id.
   */
  content?: {
    chiefComplaint?: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
};

export type Vitals = {
  id: string;
  code: string;
  weightLbs?: number;
  tempF?: number;
  heartRateBpm?: number;
  respRateBpm?: number;
  crtSec?: string;
  mucousMembrane?: string;
  painScore?: number;
  bcs?: number;
  notes?: string;
  recordedByName: string;
  /** Practitioner id of the recorder (from the Observation performer), used to
   *  resolve a display name against the team roster when no name is stored. */
  recordedById?: string;
  recordedAt: string;
};

export type ObservationToolKey = 'FGS' | 'CSU_CAP';

export type ObservationToolDefinition = {
  key: ObservationToolKey;
  name: string;
  intro: string;
};

export type ObservationRecord = {
  id: string;
  code: string;
  toolKey: ObservationToolKey | (string & {});
  toolName: string;
  scores: Record<string, number | string>;
  total?: number;
  recordedByName: string;
  recordedAt: string;
};

export type DiagnosticOrderStatus = 'CREATED' | 'SUBMITTED' | 'COMPLETED';

export type DiagnosticResultRow = {
  test: string;
  value: string;
  reference: string;
  meter: string;
};

export type DiagnosticQueueKind = 'LAB_ORDER' | 'LAB_RESULT' | 'PROVIDER_TEST';

export type DiagnosticOrder = {
  id: string;
  orderCode: string;
  createdAt: string;
  status: DiagnosticOrderStatus;
  results?: DiagnosticResultRow[];
  /** Backend diagnostic read-model item kind (order, result, or preloaded test). */
  kind?: DiagnosticQueueKind;
  /** Diagnostic provider (e.g. IDEXX). */
  provider?: string;
  /** Human-readable test/order label. */
  name?: string;
  /** Origin of a preloaded test: PRODUCT_ITEM (service) or PACKAGE_ITEM (package). */
  sourceKind?: string;
};

export type DiagnosticTestCard = {
  id: string;
  name: string;
  priceCents: number;
  currency?: string;
  orderCode?: string;
  turnaround?: string;
  specimen?: string;
};

export type LineItemKind = 'SERVICE' | 'PACKAGE';

/** Origin of a searchable bill item, surfaced as a pill in the search dropdown. */
export type BillableKind =
  | 'EXISTING_TREATMENT'
  | 'IN_HOUSE_PRESCRIPTION'
  | 'PACKAGE_COMPONENT'
  | 'BILLING_ONLY'
  | 'INVENTORY';

/** A component line shown when a package line item is expanded. */
export type LineItemBreakdown = {
  id: string;
  name: string;
  qty: number;
  instructions?: string;
  amountCents: number;
};

export type LineItem = {
  id: string;
  refId: string;
  kind: LineItemKind;
  name: string;
  qty: number;
  instructions?: string;
  unitPriceCents: number;
  amountCents: number;
  breakdown?: LineItemBreakdown[];
  /** True once the item is on a finalized/paid invoice — moves it to read-only "Past items". */
  billed?: boolean;
  /** When the item was billed (display only). */
  billedAt?: string;
  /** Who finalized/charged the item (display only). */
  billedByName?: string;
};

export type PrescriptionFulfillment = 'IN_HOUSE' | 'PRESCRIPTION_ONLY';

export type PrescriptionItem = {
  id: string;
  medicineName: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  durationDays?: string;
  /** Quantity to dispense from inventory (units). Definable in the template and editable in the
   * workspace; drives stock decrement and billing. */
  qty?: string;
  /** Number of refills allowed for this medication. */
  refill?: string;
  instructions?: string;
  fulfillment: PrescriptionFulfillment;
  /** Line price in cents, shown at the right end of the row. */
  priceCents?: number;
  /** Source inventory item, required before stock can be consumed/dispensed. */
  inventoryItemId?: string;
  /** Optional source batch for controlled or batch-tracked stock consumption. */
  inventoryBatchId?: string;
  /** On-hand inventory count; drives the In stock / Low stock health pill. */
  stockQty?: number;
  /** True when the on-hand count is at/below the reorder threshold. */
  lowStock?: boolean;
  /** Flags a DEA/controlled drug; drives the controlled-substance pill. */
  controlledSubstance?: boolean;
  /** True once the item is on a finalized/paid invoice — moves it to read-only "Past items". */
  billed?: boolean;
  /** When the item was billed (display only). */
  billedAt?: string;
  /** Who finalized/charged the item (display only). */
  billedByName?: string;
};

/** Full employee + schedule task category set. */
export type EmployeeTaskCategory =
  | 'Consultation (billable)'
  | 'Medication'
  | 'Care'
  | 'Treatment'
  | 'Diagnostic'
  | 'Communication'
  | 'Billing'
  | 'Record'
  | 'SOAP'
  | 'Admin'
  | 'Custom';

/** Restricted parent-task category set (Record => Observation Tool only). */
export type ParentTaskCategory =
  | 'Medication'
  | 'Care'
  | 'Diet'
  | 'Communication'
  | 'Billing'
  | 'Record'
  | 'Custom reminders';

export type TaskRepeat = 'None' | 'Daily' | 'Weekly' | 'Monthly';

export type TaskAssigneeKind = 'EMPLOYEE' | 'PARENT' | 'CO_PARENT';

export type ScheduleTaskStatus = 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | 'PENDING';

export type ScheduleTask = {
  id: string;
  time?: string;
  description: string;
  category: EmployeeTaskCategory;
  assignedToId?: string;
  assignedToName?: string;
  status: ScheduleTaskStatus;
  startDate?: string;
  endDate?: string;
  autoGenerated: boolean;
  sourceRefId?: string;
};

export type PaymentMethod = 'ONLINE' | 'CASH' | 'DEPOSIT';

export type InvoiceStatus = 'PAID_FULL' | 'UNPAID' | 'PARTIAL';

export type InvoiceLineItem = {
  id: string;
  name: string;
  unitPriceCents: number;
  qty: number;
  grossCents: number;
  discountCents: number;
  amountCents: number;
  /** Catalog max-discount percent; used as the canonical editable discount ceiling. */
  maxDiscountPercent?: number;
  /** Per-line discount ceiling in cents (from the catalog max-discount %); caps manual edits. */
  maxDiscountCents?: number;
  /** Component lines included in a package, shown as read-only package detail in the bill. */
  breakdown?: LineItemBreakdown[];
};

export type PastInvoice = {
  id: string;
  createdAt: string;
  totalCents: number;
  outstandingCents: number;
  status: InvoiceStatus;
  byName?: string;
  /** Who recorded the payment and when (shown as the finalized stamp). */
  paidByName?: string;
  paidAt?: string;
  /** Method used to settle the invoice; drives the "Paid via …" stamp. */
  paymentMethod?: PaymentMethod;
  /** True when the balance was cleared from the patient deposit. */
  paidFromDeposit?: boolean;
  items: InvoiceLineItem[];
  /**
   * Payment ledger for this invoice — deposits and settlements with provider metadata and the
   * downloadable receipt URL (finance gap doc Gap 6). Populated from the richer invoice response
   * once the backend exposes it (handoff §5); empty/absent until then.
   */
  payments?: PastInvoicePayment[];
  /** Backend-rendered finalized invoice PDF, when exposed as a document artifact. */
  pdfUrl?: string;
  /** Rendered-document id for finalized invoice output when the URL must be resolved elsewhere. */
  renderedDocumentId?: string;
};

export type PastInvoicePayment = {
  id: string;
  amountCents: number;
  method?: string;
  provider?: string;
  status?: string;
  paidAt?: string;
  receiptUrl?: string;
};

export type WorkspaceDocumentCategory =
  | 'SOAP'
  | 'Diagnostics'
  | 'Treatment'
  | 'Invoice'
  | 'Discharge'
  | 'Consent';

export type WorkspaceDocument = {
  id: string;
  sourceKind?: string;
  sourceId?: string;
  status?: string;
  signingStatus?: string;
  pdfUrl?: string | null;
  createdAt: string;
  category: WorkspaceDocumentCategory;
  description: string;
  signedByName?: string;
  lastModifiedAt: string;
  signatureRequired?: boolean;
};

export type RoomUnit = {
  id: string;
  name: string;
  occupied: boolean;
};

export type AppointmentEncounter = {
  appointmentId: string;
  mode: EncounterMode;
  consultationType: string;
  leadId?: string;
  leadName?: string;
  nurseId?: string;
  nurseName?: string;
  alerts: CompanionAlert[];
  soap: SoapNoteEntry[];
  soapTemplates: SoapTemplate[];
  vitals: Vitals[];
  observations: ObservationRecord[];
  diagnosticTests: DiagnosticTestCard[];
  diagnosticOrders: DiagnosticOrder[];
  services: LineItem[];
  prescription: PrescriptionItem[];
  schedule: ScheduleTask[];
  roomId?: string;
  unitId?: string;
  admittedAt?: string;
  dischargedAt?: string;
  invoiceLineItems: InvoiceLineItem[];
  pastInvoices: PastInvoice[];
  depositCents: number;
  /** ISO currency code for this encounter's billing (from finance/org); defaults to USD. */
  currency: string;
  withdrawDeposit: boolean;
  taxPercent: number;
  overallDiscountPercent: number;
  dischargeSummary: string;
  followUpAt?: string;
  /** Set when the discharge summary is saved — drives the read-only saved view. */
  dischargeSavedAt?: string;
  dischargeSavedByName?: string;
  /** Backend artifact id once persisted, so later saves PATCH instead of POSTing a duplicate. */
  dischargeSummaryId?: string;
  documents: WorkspaceDocument[];
  readyForBilling: ReadyState;
  readyForDischarge: ReadyState;
  stepStatus: Record<WorkspaceStep, StepStatus>;
  lockedAt?: string;
  viewOnly: boolean;
  /**
   * Backend-owned per-section lock decisions from the workspace bootstrap. When a
   * section is present here it is authoritative; when absent, sections fall back to
   * the client-derived `viewOnly`/lock-window behaviour. Ready for the backend
   * "Section Locks And Capabilities" contract landing in parallel.
   */
  sectionLocks?: WorkspaceLockState;
  /** Backend-owned effective capability flags from the workspace bootstrap. */
  capabilities?: WorkspaceCapabilities;
  /** Backend-owned recommended next action from the workspace bootstrap. */
  primaryAction?: WorkspacePrimaryAction;
  /** Backend-owned finalization (discharge/finalize) readiness from the bootstrap. */
  finalizationGate?: WorkspaceFinalizationGate;
};

/**
 * Backend-owned lock decision for a single workspace section. When the workspace
 * bootstrap returns these (BE "Backend-Owned Section Locks And Capabilities"),
 * sections read `locked` + `reason` from here instead of deriving a single
 * client-side `viewOnly` flag. Absent until the backend ships the contract — the
 * UI must fall back to the existing `viewOnly`/lock-window behaviour when missing.
 */
export type SectionLock = {
  locked: boolean;
  reason?: string;
};

/** The workspace sections the backend can lock independently. */
export type WorkspaceLockSection =
  | 'appointment'
  | 'soap'
  | 'vitals'
  | 'treatment'
  | 'diagnostics'
  | 'prescriptions'
  | 'inpatientSchedule'
  | 'forms'
  | 'documents'
  | 'roomUnit'
  | 'discharge'
  | 'invoice';

export type WorkspaceLockState = Partial<Record<WorkspaceLockSection, SectionLock>>;

/** Effective per-action capability flags returned by the backend bootstrap. */
export type WorkspaceCapability =
  | 'canEditSoap'
  | 'canRecordVitals'
  | 'canEditTreatment'
  | 'canOrderDiagnostics'
  | 'canPrescribe'
  | 'canDispenseInventory'
  | 'canAssignForms'
  | 'canManageTasks'
  | 'canMarkReadyForBilling'
  | 'canMarkReadyForDischarge'
  | 'canFinalizeDischarge'
  | 'canViewFinance'
  | 'canCollectPayment';

export type WorkspaceCapabilities = Partial<Record<WorkspaceCapability, boolean>>;

/**
 * Backend-owned "next action" for the encounter (workspace header / board CTA).
 * Rendered as the recommended next step; never re-derived client-side.
 */
export type WorkspacePrimaryAction = {
  kind?: string;
  label: string;
  detail?: string;
  enabled: boolean;
  disabledReason?: string;
};

/**
 * Backend-owned finalization (discharge/finalize) readiness. `enabled === true` is
 * the only safe signal that finalize/discharge may proceed; the boolean fields are
 * a per-requirement checklist for the UI.
 */
export type WorkspaceFinalizationGate = {
  enabled: boolean;
  disabledReason?: string;
  requiredSoapOrDischargeComplete?: boolean;
  requiredFormsSigned?: boolean;
  pendingLabsResolved?: boolean;
  billingReady?: boolean;
  pendingDispenseRequestsResolved?: boolean;
  inpatientRoomAdmissionReady?: boolean;
  requiredTasksComplete?: boolean;
};

export type SideAction = 'RECORD' | 'TASKS' | 'DOCUMENTS' | 'CHAT' | 'ACTIVITY' | 'MSD';
