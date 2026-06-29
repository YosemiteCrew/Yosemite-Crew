import api, { deleteData, getData, patchData, postData } from '@/app/services/axios';
import type { WorkspaceDocumentRow, WorkspaceDocumentPacketSigning } from '@yosemite-crew/types';
import type {
  AppointmentEncounter,
  DiagnosticOrder,
  EncounterMode,
  LineItem,
  PrescriptionItem,
  ReadyState,
  WorkspaceCapabilities,
  WorkspaceCapability,
  WorkspaceDocument,
  WorkspaceFinalizationGate,
  WorkspaceLockSection,
  WorkspaceLockState,
  WorkspacePrimaryAction,
  WorkspaceStep,
} from '@/app/features/appointments/types/workspace';

export type WorkspaceBootstrapDTO = Record<string, unknown>;
export type WorkspaceDocumentDTO = Record<string, unknown>;
export type TreatmentItemDTO = Record<string, unknown>;

export interface WorkspaceDocumentPacketDTO {
  packetId?: string;
  status?: string;
  // Use the shared signing contract type — it has no Date fields so it imports
  // cleanly over the wire. (The full WorkspaceDocumentPacketRow has string-vs-Date
  // drift, so we keep this thin DTO rather than importing the whole row.)
  signing?: WorkspaceDocumentPacketSigning | null;
  [key: string]: unknown;
}

const STEP_STATUS_BY_AGGREGATE_KEY: Partial<Record<string, WorkspaceStep>> = {
  clinicalArtifacts: 'SOAP',
  vitals: 'SOAP',
  prescriptions: 'TREATMENT',
  treatmentItems: 'TREATMENT',
  diagnosticQueue: 'DIAGNOSTICS',
  documents: 'SUMMARY',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
};

const asIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const asOptionalIso = (value: unknown): string | undefined => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
};

const readFirstString = (source: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = asString(source[key]);
    if (value) return value;
  }
  return undefined;
};

const readFirstIso = (source: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = asOptionalIso(source[key]);
    if (value) return value;
  }
  return undefined;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const buildReadyState = (
  source: Record<string, unknown>,
  fallbackSource: Record<string, unknown>,
  timestampKeys: string[],
  nameKeys: string[],
  idKeys: string[]
): ReadyState => ({
  value: true,
  at:
    readFirstIso(source, timestampKeys) ??
    readFirstIso(fallbackSource, timestampKeys) ??
    readFirstIso(fallbackSource, ['updatedAt', 'modifiedAt', 'createdAt']),
  byName: readFirstString(source, nameKeys) ?? readFirstString(fallbackSource, nameKeys),
  byUserId: readFirstString(source, idKeys) ?? readFirstString(fallbackSource, idKeys),
});

const resolveAggregateMode = (bootstrap: WorkspaceBootstrapDTO): EncounterMode | undefined => {
  const encounter = isRecord(bootstrap.encounter) ? bootstrap.encounter : undefined;
  const appointment = isRecord(bootstrap.appointment) ? bootstrap.appointment : undefined;
  const kind = asString(encounter?.appointmentKind) ?? asString(appointment?.kind);
  const encounterClass = asString(encounter?.encounterClass);
  if (kind === 'INPATIENT' || encounterClass === 'IMP') return 'INPATIENT';
  if (kind === 'OUTPATIENT' || encounterClass === 'AMB') return 'OUTPATIENT';
  return undefined;
};

const diagnosticStatus = (status: string | undefined): DiagnosticOrder['status'] => {
  const normalized = status?.toUpperCase();
  if (normalized === 'RESULTED' || normalized === 'COMPLETE' || normalized === 'FINAL') {
    return 'COMPLETED';
  }
  if (normalized === 'SUBMITTED' || normalized === 'AT_THE_LAB' || normalized === 'RUNNING') {
    return 'SUBMITTED';
  }
  return 'CREATED';
};

const diagnosticQueueKind = (value: string | undefined): DiagnosticOrder['kind'] => {
  if (value === 'LAB_ORDER' || value === 'LAB_RESULT' || value === 'PROVIDER_TEST') return value;
  return undefined;
};

const normalizeDiagnosticQueue = (items: Record<string, unknown>[]): DiagnosticOrder[] =>
  items.map((item, index) => ({
    id: asString(item.id) ?? `diagnostic-${index + 1}`,
    orderCode:
      asString(item.providerTestCode) ??
      asString(item.sourceId) ??
      asString(item.id) ??
      `DX-${index + 1}`,
    createdAt: asIso(item.createdAt),
    status: diagnosticStatus(asString(item.status)),
    kind: diagnosticQueueKind(asString(item.kind)),
    provider: asString(item.provider),
    name: asString(item.label),
    sourceKind: asString(item.sourceKind),
  }));

const normalizeDocuments = (items: Record<string, unknown>[]): WorkspaceDocument[] =>
  items.map((item, index) => ({
    id: asString(item.documentId) ?? asString(item.id) ?? `document-${index + 1}`,
    sourceKind: asString(item.sourceKind),
    sourceId: asString(item.sourceId),
    status: asString(item.status),
    signingStatus: asString(item.signingStatus),
    pdfUrl: asString(item.pdfUrl) ?? null,
    createdAt: asIso(item.createdAt),
    category: asString(item.kind) === 'DISCHARGE_SUMMARY' ? 'Discharge' : 'Consent',
    description: asString(item.title) ?? 'Workspace document',
    lastModifiedAt: asIso(item.updatedAt),
    signatureRequired: asString(item.signingStatus) !== 'SIGNED',
  }));

// Treatment items whose kind is a medicine belong in the prescription section, not the
// Services & Packages section. The backend uses `MEDICATION` (catalog kind) for expanded
// package components and the legacy `PRESCRIPTION` value for stored prescriptions — treat
// both the same.
const MEDICATION_TREATMENT_KINDS = new Set(['MEDICATION', 'PRESCRIPTION']);

const isMedicationTreatmentItem = (item: Record<string, unknown>): boolean =>
  MEDICATION_TREATMENT_KINDS.has(asString(item.servicePackageKind) ?? '');

const normalizeTreatmentItems = (items: Record<string, unknown>[]): LineItem[] =>
  items
    .filter((item) => !isMedicationTreatmentItem(item))
    .map((item, index) => {
      const productSnapshot = isRecord(item.productSnapshot) ? item.productSnapshot : {};
      const priceSnapshot = isRecord(item.priceSnapshot) ? item.priceSnapshot : {};
      const qty = asNumber(item.quantity) ?? 1;
      const unitPriceCents = Math.round((asNumber(priceSnapshot.unitPrice) ?? 0) * 100);
      return {
        id: asString(item.id) ?? `treatment-${index + 1}`,
        refId: asString(item.productId) ?? asString(item.id) ?? `product-${index + 1}`,
        kind: asString(item.servicePackageKind) === 'PACKAGE' ? 'PACKAGE' : 'SERVICE',
        name: asString(item.name) ?? asString(productSnapshot.name) ?? 'Treatment item',
        qty,
        unitPriceCents,
        amountCents: unitPriceCents * qty,
        billed: asString(item.billingStatus) === 'BILLED',
      };
    });

const medicationTreatmentItemToPrescription = (
  item: Record<string, unknown>,
  index: number
): PrescriptionItem => {
  const productSnapshot = isRecord(item.productSnapshot) ? item.productSnapshot : {};
  const priceSnapshot = isRecord(item.priceSnapshot) ? item.priceSnapshot : {};
  const priceCents = Math.round((asNumber(priceSnapshot.unitPrice) ?? 0) * 100);
  return {
    id: asString(item.id) ?? `prescription-${index + 1}`,
    medicineName: asString(item.name) ?? asString(productSnapshot.name) ?? 'Medication',
    instructions: asString(productSnapshot.instructions),
    // Package-expanded medications are dispensed in-house by default.
    fulfillment: 'IN_HOUSE',
    priceCents,
    inventoryItemId: asString(item.productId) ?? asString(productSnapshot.inventoryItemId),
    billed: asString(item.billingStatus) === 'BILLED',
  };
};

// Prescriptions come from two server sources: explicitly stored prescription artifacts
// (`bootstrap.prescriptions`) and medication-kind treatment items the backend expands from
// a booked package. Merge both, de-duplicating by id.
// A single `bootstrap.prescriptions` entry is the server's
// `{ artifact, prescription }` envelope: `artifact` carries the clinical record
// (id/summary/status) and `prescription` carries the orderable rows
// (`items[]`). Older/flat payloads put the fields at the top level. Read both,
// expanding each prescription line into its own PrescriptionItem so dose/route/
// frequency render per medication.
const fulfillmentFrom = (value: unknown): PrescriptionItem['fulfillment'] =>
  asString(value) === 'PRESCRIPTION_ONLY' ? 'PRESCRIPTION_ONLY' : 'IN_HOUSE';

const prescriptionLinesFromEnvelope = (item: Record<string, unknown>): PrescriptionItem[] => {
  const artifact = isRecord(item.artifact) ? item.artifact : item;
  const prescription = isRecord(item.prescription) ? item.prescription : item;
  const productSnapshot = isRecord(item.productSnapshot) ? item.productSnapshot : {};
  const priceSnapshot = isRecord(item.priceSnapshot) ? item.priceSnapshot : {};
  // Prefer the artifact `summary` as the human medication label — the per-line
  // `medication` field is often blank when the order came from an inventory pick.
  const summaryName = asString(artifact.summary);
  const fallbackName =
    summaryName ??
    asString(item.medicineName) ??
    asString(item.name) ??
    asString(productSnapshot.name) ??
    'Medication';
  const baseId =
    asString(prescription.id) ?? asString(artifact.id) ?? asString(item.id) ?? 'prescription';
  const fulfillment = fulfillmentFrom(item.fulfillment ?? prescription.fulfillment);
  const priceCents =
    asNumber(item.priceCents) ?? Math.round((asNumber(priceSnapshot.unitPrice) ?? 0) * 100);

  const lines = asArray(prescription.items);
  if (lines.length === 0) {
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    return [
      {
        id: baseId,
        medicineName: fallbackName,
        strength: asString(item.strength) ?? asString(item.dosage),
        dosageForm: asString(item.dosageForm) ?? asString(metadata.dosageForm),
        dosage: asString(item.dosage),
        route: asString(item.route),
        frequency: asString(item.frequency),
        durationDays: asString(item.durationDays) ?? asString(item.duration),
        qty: asString(item.qty) ?? asString(item.quantity),
        refill: asString(item.refill),
        instructions: asString(item.instructions) ?? asString(productSnapshot.instructions),
        fulfillment,
        priceCents,
        inventoryItemId: asString(item.inventoryItemId) ?? asString(item.productId),
        inventoryBatchId: asString(item.inventoryBatchId) ?? asString(item.batchId),
      },
    ];
  }
  return lines.map((line, lineIndex) => {
    // Display/unit fields (brand, strength unit, form, controlled flag, schedule, price, stock) are
    // stored in the per-line `metadata` JSON column — read them back so the workspace card shows
    // the full prescription after refresh, not just the core dispensing fields.
    const meta = isRecord(line.metadata) ? line.metadata : {};
    const metaStr = (key: string) => asString(line[key]) ?? asString(meta[key]);
    const metaBool = (key: string) => {
      const value = line[key] ?? meta[key];
      return typeof value === 'boolean' ? value : undefined;
    };
    return {
      id: asString(line.id) ?? `${baseId}-${lineIndex + 1}`,
      medicineName: asString(line.medication) ?? metaStr('medicineName') ?? fallbackName,
      brand: metaStr('brand'),
      genericName: metaStr('genericName'),
      sku: metaStr('sku') ?? asString(line.inventoryItemSku),
      strength: asString(line.strength),
      strengthUnit: metaStr('strengthUnit'),
      dosageForm: metaStr('dosageForm'),
      dosage: asString(line.dosage) ?? asString(line.strength),
      doseUnit: metaStr('doseUnit'),
      route: asString(line.route) ?? metaStr('route'),
      frequency: asString(line.frequency),
      durationDays: asString(line.durationDays) ?? asString(line.duration),
      durationUnit: metaStr('durationUnit'),
      qty: asString(line.qty) ?? asString(line.quantity),
      refill: asString(line.refill),
      drugSchedule: metaStr('drugSchedule'),
      prescriptionRequired: metaBool('prescriptionRequired'),
      controlledSubstance: metaBool('controlledSubstance'),
      instructions: asString(line.instructions) ?? asString(productSnapshot.instructions),
      fulfillment,
      priceCents: asNumber(meta.priceCents) ?? priceCents,
      stockQty: asNumber(line.stockQty) ?? asNumber(meta.stockQty),
      lowStock: metaBool('lowStock'),
      inventoryItemId:
        asString(line.inventoryItemId) ??
        asString(item.inventoryItemId) ??
        asString(item.productId),
      inventoryBatchId:
        asString(line.inventoryBatchId) ??
        asString(line.batchId) ??
        asString(meta.inventoryBatchId),
    };
  });
};

const normalizePrescriptions = (
  prescriptions: Record<string, unknown>[],
  treatmentItems: Record<string, unknown>[]
): PrescriptionItem[] => {
  const byId = new Map<string, PrescriptionItem>();
  const sourceIds = new Set<string>();

  // Billed lookup: the medication TREATMENT-ITEM rows carry the `billingStatus`, but the matching
  // prescription ARTIFACT line does not. Index only backend link ids (treatment-item id and
  // prescriptionId) so a same-drug prescription does not become billed by inventory item alone.
  const billedMedicationIds = new Set<string>();
  treatmentItems.filter(isMedicationTreatmentItem).forEach((item) => {
    if (asString(item.billingStatus) !== 'BILLED') return;
    [asString(item.id), asString(item.prescriptionId)]
      .filter((value): value is string => Boolean(value))
      .forEach((value) => billedMedicationIds.add(value));
  });
  const isLineBilled = (line: PrescriptionItem, linkedIds: string[]): boolean =>
    Boolean(line.billed) ||
    billedMedicationIds.has(line.id) ||
    linkedIds.some((id) => billedMedicationIds.has(id));

  prescriptions.forEach((item) => {
    // Collect backend ids that can link a medication treatment item back to this prescription.
    // Do not use inventory item ids here: the same product can be prescribed more than once.
    const artifact = isRecord(item.artifact) ? item.artifact : item;
    const prescription = isRecord(item.prescription) ? item.prescription : item;
    const linkedIds = [asString(prescription.id), asString(artifact.id), asString(item.id)].filter(
      (value): value is string => Boolean(value)
    );
    linkedIds.forEach((value) => sourceIds.add(value));
    prescriptionLinesFromEnvelope(item).forEach((line) => {
      byId.set(line.id, { ...line, billed: isLineBilled(line, linkedIds) });
    });
  });
  treatmentItems.filter(isMedicationTreatmentItem).forEach((item, index) => {
    const prescription = medicationTreatmentItemToPrescription(item, index);
    // The medication-kind treatment item and its prescription artifact share a backend link id, so
    // skip it when the artifact already produced lines.
    const linkedIds = [asString(item.prescriptionId), asString(item.id), prescription.id].filter(
      (value): value is string => Boolean(value)
    );
    if (byId.has(prescription.id) || linkedIds.some((id) => sourceIds.has(id))) return;
    byId.set(prescription.id, prescription);
  });
  return Array.from(byId.values());
};

const latestDischargeSummary = (artifacts: Record<string, unknown>[]) =>
  artifacts
    .filter((item) => {
      const artifact = isRecord(item.artifact) ? item.artifact : {};
      return asString(artifact.kind) === 'DISCHARGE_SUMMARY';
    })
    .sort((left, right) => {
      const leftArtifact = isRecord(left.artifact) ? left.artifact : {};
      const rightArtifact = isRecord(right.artifact) ? right.artifact : {};
      return (
        new Date(asIso(rightArtifact.updatedAt)).getTime() -
        new Date(asIso(leftArtifact.updatedAt)).getTime()
      );
    })[0];

const applyEncounterReadiness = (
  patch: Omit<Partial<AppointmentEncounter>, 'stepStatus'> & {
    stepStatus?: Partial<Record<WorkspaceStep, 'COMPLETED'>>;
  },
  bootstrap: WorkspaceBootstrapDTO,
  encounter: Record<string, unknown>,
  invoice: Record<string, unknown>
) => {
  const readyForDischargeFlag =
    asString(encounter.status) === 'onleave' ||
    encounter.readyForDischarge === true ||
    (isRecord(encounter.readyForDischarge) &&
      asBoolean(encounter.readyForDischarge.value) === true);
  if (readyForDischargeFlag) {
    patch.readyForDischarge = buildReadyState(
      encounter,
      encounter,
      ['readyForDischargeAt', 'readyForDischargeOn', 'dischargeReadyAt', 'updatedAt'],
      ['readyForDischargeByName', 'dischargeReadyByName', 'updatedByName', 'updatedBy'],
      ['readyForDischargeByUserId', 'dischargeReadyByUserId', 'updatedById']
    );
  }

  const billingFallback = { ...encounter, ...invoice };
  let readyForBilling = billingFallback;
  if (isRecord(bootstrap.readyForBilling)) {
    readyForBilling = bootstrap.readyForBilling;
  } else if (isRecord(encounter.readyForBilling)) {
    readyForBilling = encounter.readyForBilling;
  }
  const billingStage =
    asString(bootstrap.visitBillingStage) ??
    asString(invoice.visitBillingStage) ??
    asString(encounter.visitBillingStage);
  const readyForBillingFlag =
    billingStage === 'READY_FOR_BILLING' ||
    billingStage === 'SETTLED' ||
    bootstrap.readyForBilling === true ||
    encounter.readyForBilling === true ||
    (isRecord(bootstrap.readyForBilling) && asBoolean(bootstrap.readyForBilling.value) === true) ||
    (isRecord(encounter.readyForBilling) && asBoolean(encounter.readyForBilling.value) === true);
  if (readyForBillingFlag) {
    patch.readyForBilling = buildReadyState(
      readyForBilling,
      billingFallback,
      ['readyForBillingAt', 'billingReadyAt', 'updatedAt', 'createdAt'],
      ['readyForBillingByName', 'billingReadyByName', 'updatedByName', 'updatedBy'],
      ['readyForBillingActorId', 'readyForBillingByUserId', 'billingReadyByUserId', 'updatedById']
    );
  }
};

const applyBootstrapCollections = (
  patch: Omit<Partial<AppointmentEncounter>, 'stepStatus'> & {
    stepStatus?: Partial<Record<WorkspaceStep, 'COMPLETED'>>;
  },
  bootstrap: WorkspaceBootstrapDTO
) => {
  const diagnosticQueue = normalizeDiagnosticQueue(asArray(bootstrap.diagnosticQueue));
  if (diagnosticQueue.length) patch.diagnosticOrders = diagnosticQueue;

  const documents = normalizeDocuments(asArray(bootstrap.documents));
  if (documents.length) patch.documents = documents;

  const treatmentItems = normalizeTreatmentItems(asArray(bootstrap.treatmentItems));
  if (treatmentItems.length) patch.services = treatmentItems;

  const prescriptions = normalizePrescriptions(
    asArray(bootstrap.prescriptions),
    asArray(bootstrap.treatmentItems)
  );
  if (prescriptions.length) patch.prescription = prescriptions;

  const discharge = latestDischargeSummary(asArray(bootstrap.clinicalArtifacts));
  if (discharge) {
    const artifact = isRecord(discharge.artifact) ? discharge.artifact : {};
    const summary = isRecord(discharge.dischargeSummary) ? discharge.dischargeSummary : {};
    patch.dischargeSummary = toText(summary.summary);
    patch.followUpAt = asString(summary.followUp);
    patch.dischargeSavedAt = asIso(artifact.updatedAt ?? summary.updatedAt);
    patch.dischargeSavedByName = asString(artifact.signedBy) ?? asString(artifact.authorId);
    patch.dischargeSummaryId = asString(artifact.id);
  }
};

const LOCK_SECTIONS: WorkspaceLockSection[] = [
  'appointment',
  'soap',
  'vitals',
  'treatment',
  'diagnostics',
  'prescriptions',
  'inpatientSchedule',
  'forms',
  'documents',
  'roomUnit',
  'discharge',
  'invoice',
];

const CAPABILITY_KEYS: WorkspaceCapability[] = [
  'canEditSoap',
  'canRecordVitals',
  'canEditTreatment',
  'canOrderDiagnostics',
  'canPrescribe',
  'canDispenseInventory',
  'canAssignForms',
  'canManageTasks',
  'canMarkReadyForBilling',
  'canMarkReadyForDischarge',
  'canFinalizeDischarge',
  'canViewFinance',
  'canCollectPayment',
];

/**
 * Read the backend section-lock map (BE "Section Locks And Capabilities"). Each
 * entry is `{ locked, reason? }`. Returns undefined when the backend has not yet
 * shipped the contract so the UI keeps its client-derived lock fallback.
 */
const normalizeSectionLocks = (value: unknown): WorkspaceLockState | undefined => {
  if (!isRecord(value)) return undefined;
  const locks: WorkspaceLockState = {};
  for (const section of LOCK_SECTIONS) {
    const entry = value[section];
    if (!isRecord(entry)) continue;
    const locked = asBoolean(entry.locked);
    if (locked === undefined) continue;
    locks[section] = { locked, reason: asString(entry.reason) };
  }
  return Object.keys(locks).length > 0 ? locks : undefined;
};

const normalizeCapabilities = (value: unknown): WorkspaceCapabilities | undefined => {
  if (!isRecord(value)) return undefined;
  const capabilities: WorkspaceCapabilities = {};
  for (const key of CAPABILITY_KEYS) {
    const flag = asBoolean(value[key]);
    if (flag !== undefined) capabilities[key] = flag;
  }
  return Object.keys(capabilities).length > 0 ? capabilities : undefined;
};

const normalizePrimaryAction = (value: unknown): WorkspacePrimaryAction | undefined => {
  if (!isRecord(value)) return undefined;
  const label = asString(value.label);
  const enabled = asBoolean(value.enabled);
  // A primary action without a label is not renderable; skip it.
  if (!label) return undefined;
  return {
    kind: asString(value.kind),
    label,
    detail: asString(value.detail),
    enabled: enabled ?? true,
    disabledReason: asString(value.disabledReason),
  };
};

const FINALIZATION_GATE_FLAGS: (keyof WorkspaceFinalizationGate)[] = [
  'requiredSoapOrDischargeComplete',
  'requiredFormsSigned',
  'pendingLabsResolved',
  'billingReady',
  'pendingDispenseRequestsResolved',
  'inpatientRoomAdmissionReady',
  'requiredTasksComplete',
];

const normalizeFinalizationGate = (value: unknown): WorkspaceFinalizationGate | undefined => {
  if (!isRecord(value)) return undefined;
  const enabled = asBoolean(value.enabled);
  if (enabled === undefined) return undefined;
  const gate: WorkspaceFinalizationGate = {
    enabled,
    disabledReason: asString(value.disabledReason),
  };
  for (const flag of FINALIZATION_GATE_FLAGS) {
    const parsed = asBoolean(value[flag]);
    // `flag` keys all map to optional booleans; the dynamic index needs a cast.
    if (parsed !== undefined) (gate as unknown as Record<string, boolean>)[flag] = parsed;
  }
  return gate;
};

export const normalizeWorkspaceBootstrapForEncounter = (
  bootstrap: WorkspaceBootstrapDTO
): Omit<Partial<AppointmentEncounter>, 'stepStatus'> & {
  stepStatus?: Partial<Record<WorkspaceStep, 'COMPLETED'>>;
} => {
  const patch: Omit<Partial<AppointmentEncounter>, 'stepStatus'> & {
    stepStatus?: Partial<Record<WorkspaceStep, 'COMPLETED'>>;
  } = {};

  const mode = resolveAggregateMode(bootstrap);
  if (mode) patch.mode = mode;

  const encounter = isRecord(bootstrap.encounter) ? bootstrap.encounter : {};
  if (isRecord(encounter.admission)) {
    patch.unitId = asString(encounter.admission.unitId);
    patch.admittedAt =
      asOptionalIso(encounter.admission.admittedAt) ??
      asOptionalIso(encounter.admission.createdAt) ??
      asOptionalIso(encounter.updatedAt);
    patch.dischargedAt = asOptionalIso(encounter.admission.dischargedAt);
  }
  const invoice = isRecord(bootstrap.invoice) ? bootstrap.invoice : {};
  applyEncounterReadiness(patch, bootstrap, encounter, invoice);
  applyBootstrapCollections(patch, bootstrap);

  const sectionLocks =
    normalizeSectionLocks(bootstrap.sectionLocks) ?? normalizeSectionLocks(bootstrap.locks);
  if (sectionLocks) patch.sectionLocks = sectionLocks;
  // The backend bootstrap returns capability flags under `permissions`; accept
  // `capabilities` too for forward-compatibility.
  const capabilities =
    normalizeCapabilities(bootstrap.permissions) ?? normalizeCapabilities(bootstrap.capabilities);
  if (capabilities) patch.capabilities = capabilities;

  const primaryAction = normalizePrimaryAction(bootstrap.primaryAction);
  if (primaryAction) patch.primaryAction = primaryAction;
  const finalizationGate = normalizeFinalizationGate(bootstrap.finalizationGate);
  if (finalizationGate) patch.finalizationGate = finalizationGate;

  const stepStatus = Object.entries(STEP_STATUS_BY_AGGREGATE_KEY).reduce<
    Partial<Record<WorkspaceStep, 'COMPLETED'>>
  >((acc, [key, step]) => {
    if (step && asArray(bootstrap[key]).length > 0) acc[step] = 'COMPLETED';
    return acc;
  }, {});
  if (Object.keys(stepStatus).length > 0) patch.stepStatus = stepStatus;

  return patch;
};

export const getAppointmentWorkspaceBootstrap = async (
  organisationId: string,
  appointmentId: string
) => {
  const res = await getData<WorkspaceBootstrapDTO>(
    `/v1/workspace/organisations/${organisationId}/appointments/${appointmentId}`
  );
  return res.data;
};

export const getEncounterWorkspaceBootstrap = async (
  organisationId: string,
  encounterId: string
) => {
  const res = await getData<WorkspaceBootstrapDTO>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}`
  );
  return res.data;
};

export const listAppointmentWorkspaceDocuments = async (
  organisationId: string,
  appointmentId: string
) => {
  const res = await getData<WorkspaceDocumentDTO[]>(
    `/v1/workspace/organisations/${organisationId}/appointments/${appointmentId}/documents`
  );
  return res.data ?? [];
};

export const listEncounterWorkspaceDocuments = async (
  organisationId: string,
  encounterId: string
): Promise<WorkspaceDocumentRow[]> => {
  const res = await getData<WorkspaceDocumentRow[]>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}/documents`
  );
  return res.data ?? [];
};

export const listCompanionWorkspaceDocuments = async (
  organisationId: string,
  companionId: string
) => {
  const res = await getData<WorkspaceDocumentDTO[]>(
    `/v1/workspace/organisations/${organisationId}/companions/${companionId}/documents`
  );
  return res.data ?? [];
};

export const listCompanionMedicalRecords = async (organisationId: string, companionId: string) => {
  const res = await getData<WorkspaceDocumentDTO[]>(
    `/v1/workspace/organisations/${organisationId}/companions/${companionId}/medical-records`
  );
  return res.data ?? [];
};

export const createEncounterDocumentPacket = async (
  organisationId: string,
  encounterId: string,
  body: Record<string, unknown> = {}
) => {
  const res = await postData<WorkspaceDocumentPacketDTO>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}/document-packet`,
    body
  );
  return res.data;
};

export const getWorkspaceDocumentPacket = async (organisationId: string, packetId: string) => {
  const res = await getData<WorkspaceDocumentPacketDTO>(
    `/v1/workspace/organisations/${organisationId}/document-packets/${packetId}`
  );
  return res.data;
};

export const signWorkspaceDocumentPacket = async (
  organisationId: string,
  packetId: string,
  body: Record<string, unknown> = {}
) => {
  const res = await postData<WorkspaceDocumentPacketDTO>(
    `/v1/workspace/organisations/${organisationId}/document-packets/${packetId}/sign`,
    body
  );
  return res.data;
};

/**
 * Fetch the merged clinical packet (SOAP + Prescription + Discharge, …) as a
 * single PDF and return a blob URL for preview/print. Caller is responsible for
 * revoking the URL when done.
 */
export const getEncounterDocumentPacketPdfUrl = async (
  organisationId: string,
  encounterId: string
): Promise<string> => {
  const res = await api.get<Blob>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}/document-packet/pdf`,
    { responseType: 'blob' }
  );
  return URL.createObjectURL(res.data);
};

export const listEncounterTreatmentItems = async (organisationId: string, encounterId: string) => {
  const res = await getData<TreatmentItemDTO[]>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}/treatment-items`
  );
  return res.data ?? [];
};

export const createEncounterTreatmentItem = async (
  organisationId: string,
  encounterId: string,
  item: TreatmentItemDTO
) => {
  const res = await postData<TreatmentItemDTO>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}/treatment-items`,
    item
  );
  return res.data;
};

export const updateEncounterTreatmentItem = async (
  organisationId: string,
  itemId: string,
  patch: Partial<TreatmentItemDTO>
) => {
  const res = await patchData<TreatmentItemDTO>(
    `/v1/workspace/organisations/${organisationId}/treatment-items/${itemId}`,
    patch
  );
  return res.data;
};

export const deleteEncounterTreatmentItem = async (organisationId: string, itemId: string) => {
  await deleteData(`/v1/workspace/organisations/${organisationId}/treatment-items/${itemId}`);
};

/** True when a treatment-item row is billed/paid and therefore must not be deleted. */
const isBilledTreatmentRow = (row: Record<string, unknown>): boolean => {
  const billed = row.billed ?? row.isBilled;
  if (typeof billed === 'boolean') return billed;
  const status = asString(row.status)?.toUpperCase();
  return status === 'BILLED' || status === 'PAID' || status === 'INVOICED';
};

/**
 * Delete the backend treatment-item that backs an UNBILLED prescription. There is no dedicated
 * prescription-delete endpoint, so a saved (in-house) prescription is removed by deleting its
 * linked treatment-item row — found by matching the prescription/artifact id or the inventory
 * item id against the encounter's treatment items. Billed/paid rows are never deleted. Returns
 * true when a backend row was deleted; false when there was nothing persisted to remove.
 */
export const deletePrescriptionTreatmentItem = async (
  organisationId: string,
  encounterId: string,
  prescription: { id?: string; inventoryItemId?: string }
): Promise<boolean> => {
  const targetIds = new Set(
    [prescription.id, prescription.inventoryItemId].filter((value): value is string =>
      Boolean(value)
    )
  );
  if (targetIds.size === 0) return false;

  const rows = await listEncounterTreatmentItems(organisationId, encounterId);
  const match = rows.find((rawRow) => {
    const row = isRecord(rawRow) ? rawRow : {};
    if (isBilledTreatmentRow(row)) return false;
    const candidateIds = [
      asString(row.id),
      asString(row.prescriptionId),
      asString(row.artifactId),
      asString(row.inventoryItemId),
      asString(row.productId),
    ].filter((value): value is string => Boolean(value));
    return candidateIds.some((id) => targetIds.has(id));
  });

  const matchId = match && isRecord(match) ? asString(match.id) : undefined;
  if (!matchId) return false;
  await deleteEncounterTreatmentItem(organisationId, matchId);
  return true;
};

/** A service/package line item is backend-persisted unless it still carries a local- id. */
const isPersistedTreatmentId = (id: string): boolean => Boolean(id) && !id.startsWith('local-');

/**
 * Map a workspace service/package line item to the backend treatment-item create
 * DTO. The create endpoint requires `productId`, `productSnapshot`,
 * `servicePackageKind`, `quantity`, and `priceSnapshot` — the snapshot carries the
 * display fields the read path (`normalizeTreatmentItems`) reads back.
 */
const lineItemToTreatmentDTO = (item: LineItem): TreatmentItemDTO => ({
  productId: item.refId,
  servicePackageKind: item.kind,
  quantity: item.qty,
  priceSnapshot: { unitPrice: item.unitPriceCents / 100 },
  productSnapshot: {
    name: item.name,
    kind: item.kind,
    instructions: item.instructions,
    breakdown: item.breakdown,
  },
});

/**
 * Map a workspace service/package line item to the backend treatment-item update
 * DTO. Only the clinician-editable fields are sent so a PATCH pushes local edits
 * (quantity/price/display snapshot) onto an already-persisted row.
 */
const lineItemToTreatmentUpdateDTO = (item: LineItem): Partial<TreatmentItemDTO> =>
  lineItemToTreatmentDTO(item);

/** A backend treatment row that is an editable, unbilled service/package line. */
const isEditableServiceRow = (row: Record<string, unknown>): boolean =>
  !isMedicationTreatmentItem(row) && asString(row.billingStatus) !== 'BILLED';

/**
 * Persist the current service/package row set to the backend so it matches the
 * clinician's edits before the workspace moves on to Invoice:
 *   • new (local-) rows are POSTed,
 *   • persisted rows that remain are PATCHed so quantity/price/display edits stick,
 *   • persisted service/package rows the clinician removed locally (present on the
 *     backend but absent from `items`) are DELETEd so they don't reappear after the
 *     bootstrap refresh and can't still be billed.
 * Billed and medication-kind rows are left untouched. Throws on the first failure
 * so the caller can block the step and surface the error.
 */
export const persistTreatmentItems = async (
  organisationId: string,
  encounterId: string,
  items: LineItem[]
): Promise<void> => {
  const keptPersistedIds = new Set(
    items.map((item) => item.id).filter((id) => isPersistedTreatmentId(id))
  );

  // Reconcile removals: any unbilled service/package row on the backend that the
  // clinician dropped from the local list must be deleted.
  const backendRows = await listEncounterTreatmentItems(organisationId, encounterId);
  for (const row of backendRows) {
    const rowId = asString(row.id);
    if (!rowId || keptPersistedIds.has(rowId) || !isEditableServiceRow(row)) continue;
    await deleteEncounterTreatmentItem(organisationId, rowId);
  }

  for (const item of items) {
    if (isPersistedTreatmentId(item.id)) {
      // Push edits to an existing row.
      await updateEncounterTreatmentItem(
        organisationId,
        item.id,
        lineItemToTreatmentUpdateDTO(item)
      );
    } else {
      await createEncounterTreatmentItem(organisationId, encounterId, lineItemToTreatmentDTO(item));
    }
  }
};
