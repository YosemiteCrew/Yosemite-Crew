import type { Case } from './case';
import type { Encounter } from './encounter';
import type { ClinicalArtifactRecordLike } from './clinical-artifact';
import type { FormAssignmentLike } from './form-assignment';
import type { TaskCategory, TaskLike, TaskStatus } from './task';
import type { TemplateInstanceLike } from './template';
import type { TaskScheduleLike } from './task-schedule';

export interface WorkspaceSummaryItem {
  id: string;
  name: string | null;
  status: string | null;
  kind: string | null;
  productItemId?: string | null;
  productKind?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceDocumentRow {
  documentId: string;
  sourceKind: string;
  sourceId: string;
  appointmentId: string | null;
  encounterId: string | null;
  companionId: string | null;
  templateId: string | null;
  templateVersion: number | null;
  title: string;
  kind: string;
  status: string;
  signingStatus: string;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceDocumentPacketStatus = 'DRAFT' | 'FINAL';

export type WorkspaceDocumentPacketSigningStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SIGNED';

export interface WorkspaceDocumentPacketSigning {
  required: boolean;
  provider: 'DOCUMENSO';
  status: WorkspaceDocumentPacketSigningStatus;
  documentId: string | null;
  signerId: string;
  signerEmail: string;
  signerName: string | null;
  signingUrl: string | null;
  /** Ids of the child RenderedDocuments bundled into the signed packet. */
  documentIds: string[];
  pdf?: { url: string | null };
}

export interface WorkspaceDocumentPacketRow {
  packetId: string;
  organisationId: string;
  appointmentId: string | null;
  encounterId: string;
  companionId: string | null;
  documents: WorkspaceDocumentRow[];
  status: WorkspaceDocumentPacketStatus;
  signing: WorkspaceDocumentPacketSigning | null;
  signedBy: string | null;
  signedByName: string | null;
  signedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceLockState {
  appointment: boolean;
  encounter: boolean;
  episodeOfCare: boolean;
  templateInstances: boolean;
  clinicalArtifacts: boolean;
  prescriptions: boolean;
  documents: boolean;
  treatmentItems: boolean;
}

export interface WorkspacePermissionSnapshot {
  permissions: string[];
  canViewAppointments: boolean;
  canViewTasks: boolean;
  canViewDocuments: boolean;
  canViewForms: boolean;
  canViewPrescriptions: boolean;
  canViewLabs: boolean;
  canEditSoap: boolean;
  canPrescribe: boolean;
  canSignDocuments: boolean;
  canDischarge: boolean;
  canAssignTasks: boolean;
  canResumeSchedules: boolean;
  canCancelSchedules: boolean;
}

export interface WorkspacePrimaryAction {
  kind: 'COMPLETE_FORMS' | 'REVIEW_TASKS' | 'CONTINUE_CHARTING' | 'VIEW_LABS' | 'VIEW_SUMMARY';
  label: string;
  detail: string;
  enabled: boolean;
  disabledReason: string | null;
}

export interface WorkspaceFinalizationGate {
  enabled: boolean;
  disabledReason: string | null;
  requiredSoapOrDischargeComplete: boolean;
  requiredFormsSigned: boolean;
  pendingLabsResolved: boolean;
  billingReady: boolean;
  pendingDispenseRequestsResolved: boolean;
  inpatientRoomAdmissionReady: boolean;
  requiredTasksComplete: boolean;
}

export interface WorkspaceFormRow extends Omit<FormAssignmentLike, 'status'> {
  status: 'completed' | 'pending';
  assignmentStatus: FormAssignmentLike['status'];
  questionnaireResponse?: unknown;
  questionnaire?: unknown;
}

export interface WorkspaceLabSummary {
  hasLabs: boolean;
  orders: unknown[];
  results: unknown[];
  pendingCount: number;
  resultedCount: number;
  failedCount: number;
  requiredPendingCount: number;
  providers: string[];
  latestStatus: 'NONE' | 'QUEUED' | 'ORDERED' | 'PARTIAL' | 'RESULTED' | 'FAILED';
  blockingFinalization: boolean;
}

export interface WorkspaceDiagnosticQueueItem {
  id: string;
  kind: 'LAB_ORDER' | 'LAB_RESULT' | 'PROVIDER_TEST';
  provider: string | null;
  providerTestCode: string | null;
  status: string | null;
  label: string;
  sourceKind: 'LAB_ORDER' | 'LAB_RESULT' | 'PRODUCT_ITEM' | 'PACKAGE_ITEM';
  sourceId: string | null;
  sourceProductId: string | null;
  sourcePackageId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceTreatmentItem {
  id: string;
  organisationId: string;
  appointmentId: string | null;
  encounterId: string;
  productId: string;
  productVersion: number | null;
  productSnapshot: Record<string, unknown>;
  servicePackageKind: string;
  quantity: number;
  priceSnapshot: Record<string, unknown>;
  billingStatus: string;
  invoiceRowId: string | null;
  settled?: boolean;
  settledInvoiceId?: string | null;
  settledAt?: Date | null;
  lockState: Record<string, unknown> | string | null;
  prescriptionId?: string | null;
  name?: string;
  medicationCount?: number;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceTreatmentItemCreateInput {
  organisationId: string;
  appointmentId?: string | null;
  encounterId: string;
  productId: string;
  productVersion?: number | null;
  productSnapshot: Record<string, unknown>;
  servicePackageKind: string;
  quantity: number;
  priceSnapshot: Record<string, unknown>;
  billingStatus?: string;
  invoiceRowId?: string | null;
  lockState?: Record<string, unknown> | string | null;
}

export interface WorkspaceTreatmentItemUpdateInput {
  appointmentId?: string | null;
  productId?: string;
  productVersion?: number | null;
  productSnapshot?: Record<string, unknown>;
  servicePackageKind?: string;
  quantity?: number;
  priceSnapshot?: Record<string, unknown>;
  billingStatus?: string;
  invoiceRowId?: string | null;
  lockState?: Record<string, unknown> | string | null;
}

export interface WorkspaceBootstrapResponse {
  organisationId: string;
  appointment: WorkspaceSummaryItem | null;
  encounter: Encounter | null;
  episodeOfCare: Case | null;
  companion: WorkspaceSummaryItem | null;
  client: WorkspaceSummaryItem | null;
  templateInstances: TemplateInstanceLike[];
  clinicalArtifacts: ClinicalArtifactRecordLike[];
  vitals: ClinicalArtifactRecordLike[];
  prescriptions: ClinicalArtifactRecordLike[];
  treatmentItems: WorkspaceTreatmentItem[];
  diagnosticQueue: WorkspaceDiagnosticQueueItem[];
  labSummary: WorkspaceLabSummary;
  tasks: TaskLike[];
  schedules: TaskScheduleLike[];
  forms: WorkspaceFormRow[];
  documents: WorkspaceDocumentRow[];
  locks: WorkspaceLockState;
  permissions: WorkspacePermissionSnapshot;
  finalizationGate: WorkspaceFinalizationGate;
  primaryAction: WorkspacePrimaryAction;
  readyForBilling?: boolean;
  readyForDischarge?: boolean;
  readyForBillingByName?: string | null;
  readyForDischargeByName?: string | null;
}

export type WorkspaceBootstrapAggregate = WorkspaceBootstrapResponse;

export interface WorkspaceBootstrapInput {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
}
