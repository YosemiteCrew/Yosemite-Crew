import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import WorkspaceSearchResultRow from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceSearchResultRow';
import type {
  Appointment,
  TemplateLike,
  TemplateSchemaSnapshot,
  WorkspaceDocumentRow,
} from '@yosemite-crew/types';
import {
  LuDownload,
  LuEye,
  LuFileSignature,
  LuPencil,
  LuPrinter,
  LuSave,
  LuSearch,
} from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import Search from '@/app/ui/inputs/Search';
import Datepicker from '@/app/ui/inputs/Datepicker';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import SigningOverlay from '@/app/ui/overlays/SigningOverlay';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import { isRichTextEmpty, sanitizeRichText } from '@/app/lib/richText';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';
import { usePermissions } from '@/app/hooks/usePermissions';
import {
  getRenderedDocument,
  saveDischargeSummaryArtifact,
} from '@/app/features/appointments/services/workspaceClinicalService';
import {
  extractFollowUpInDays,
  listDischargeSummaryTemplates,
  resolveDischargeTemplate,
} from '@/app/features/appointments/services/workspaceTemplateService';
import {
  createEncounterDocumentPacket,
  getAppointmentWorkspaceBootstrap,
  getEncounterDocumentPacketPdfUrl,
  listEncounterWorkspaceDocuments,
  normalizeWorkspaceBootstrapForEncounter,
  reconcileWorkspaceDocumentPacket,
  signWorkspaceDocumentPacket,
} from '@/app/features/appointments/services/workspaceAggregateService';

type SummaryStepProps = {
  appointmentId: string;
  appointment?: Appointment;
  encounter: AppointmentEncounter;
  /**
   * The encounter id resolved by the parent's lifecycle hydration
   * (`lifecycleEncounterIdRef`). When the appointment prop predates bootstrap it
   * still carries no `encounterId`, so the parent threads the hydrated id here.
   */
  resolvedEncounterId?: string;
};

/** Pull the backend encounter id out of a workspace bootstrap payload. */
const getBootstrapEncounterId = (bootstrap: unknown): string | undefined => {
  if (!bootstrap || typeof bootstrap !== 'object') return undefined;
  const encounter = (bootstrap as { encounter?: unknown }).encounter;
  if (!encounter || typeof encounter !== 'object') return undefined;
  const id = (encounter as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id : undefined;
};

const formatDateTime = (iso: string): string => {
  const date = formatStampDate(iso);
  const time = formatStampTime(iso);
  return [date, time].filter(Boolean).join(', ');
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const hasTemplateSchemaSnapshot = (value: unknown): value is TemplateSchemaSnapshot =>
  Boolean(
    value && typeof value === 'object' && Array.isArray((value as { sections?: unknown }).sections)
  );

const getTemplateSchemaSnapshot = (template: TemplateLike): TemplateSchemaSnapshot | undefined => {
  const rootSnapshot = (template as TemplateLike & { schemaSnapshot?: unknown }).schemaSnapshot;
  if (hasTemplateSchemaSnapshot(rootSnapshot)) return rootSnapshot;
  const version = template.versions?.find(
    (item) => item.version === template.publishedVersion || item.version === template.latestVersion
  );
  return hasTemplateSchemaSnapshot(version?.schemaSnapshot) ? version.schemaSnapshot : undefined;
};

const DISCHARGE_META_FIELD_KEYS = new Set(['followUpInDays', 'followUpDate']);

const normalizeTemplateLabel = (value: string): string => value.trim().toLowerCase();

type TemplateField = TemplateSchemaSnapshot['sections'][number]['fields'][number];

/** Humanise a backend enum token (e.g. "DISCHARGE_SUMMARY" → "Discharge summary",
 *  "NOT_REQUIRED" → "Not required") so raw enums never reach the table. */
const humanizeToken = (value?: string | null): string => {
  if (!value) return '-';
  const words = value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean);
  if (words.length === 0) return '-';
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
};

const htmlFromDefaultValue = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const fieldDefaultToHtml = (field: TemplateField): string => {
  if (DISCHARGE_META_FIELD_KEYS.has(field.key)) return '';
  const defaultValue = htmlFromDefaultValue(field.defaultValue);
  if (!defaultValue) return '';
  if (field.type === 'richText') return sanitizeRichText(defaultValue);
  return `<p><strong>${escapeHtml(field.label || field.key)}:</strong> ${escapeHtml(defaultValue)}</p>`;
};

const medicationColumnLabels = (field: TemplateField): string[] => {
  const columns = field.rules?.columns;
  if (!Array.isArray(columns)) return ['Drug', 'Dose', 'Frequency', 'Duration'];
  return columns
    .filter((column): column is string => typeof column === 'string' && column.trim().length > 0)
    .map(humanizeToken);
};

const fieldOutlineToHtml = (field: TemplateField): string => {
  if (DISCHARGE_META_FIELD_KEYS.has(field.key)) return '';
  if (field.type === 'richText' || field.type === 'instructionBlock') return '<p><br></p>';
  if (field.type === 'diagnosis') return '<ul><li>Diagnosis: </li></ul>';
  if (field.type === 'medicationLine') {
    const labels = medicationColumnLabels(field)
      .map((label) => `${escapeHtml(label)}: `)
      .join(' | ');
    return `<ul><li>${labels}</li></ul>`;
  }
  return `<p><strong>${escapeHtml(field.label || field.key)}:</strong> </p>`;
};

const schemaSnapshotToDischargeHtml = (snapshot?: TemplateSchemaSnapshot): string => {
  const sections = snapshot?.sections ?? [];
  if (sections.length === 0) return '';
  return sections
    .map((section) => {
      const defaultFields = section.fields.map(fieldDefaultToHtml).filter(Boolean);
      if (defaultFields.length > 0) return defaultFields.join('');

      const outlineFields = section.fields
        .map((field) => ({
          html: fieldOutlineToHtml(field),
          label: field.label || field.key,
        }))
        .filter((field) => field.html);
      if (outlineFields.length === 0) return '';

      const duplicatesOnlyField =
        outlineFields.length === 1 &&
        normalizeTemplateLabel(outlineFields[0].label) === normalizeTemplateLabel(section.title);
      const heading = duplicatesOnlyField
        ? ''
        : `<p><strong>${escapeHtml(section.title)}</strong></p>`;
      return `${heading}${outlineFields.map((field) => field.html).join('')}`;
    })
    .join('');
};

/** ISO follow-up timestamp ⇄ the Datepicker's `Date | null` value. */
const toFollowUpDate = (iso?: string): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** The documents read-model types timestamps as `Date` in the contract but they
 *  arrive as JSON strings over the wire — normalise to ISO for formatting. */
const toIsoString = (value: string | Date): string =>
  typeof value === 'string' ? value : new Date(value).toISOString();

const DocumentSourcePill = ({ source }: { source: string }) => (
  <span className="inline-flex rounded-2xl border border-[#D6D1CD] bg-[#FAF8F6] px-3 py-1 text-caption-1 text-text-primary">
    {humanizeToken(source)}
  </span>
);

/** Shared column template (mirrors the Invoice table) so the heading and row
 *  grids resolve to identical track widths. The Actions track is fixed. */
const DOCUMENT_COLS =
  'sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_92px]';
const DOCUMENT_ROW_GRID = `grid gap-3 ${DOCUMENT_COLS} sm:items-center`;

const downloadDocumentUrl = (url: string) => {
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = '';
  link.rel = 'noopener noreferrer';
  globalThis.document.body.append(link);
  link.click();
  link.remove();
};

const AllDocumentsTable = ({
  documents,
  organisationId,
  canView,
  error,
}: {
  documents: WorkspaceDocumentRow[];
  organisationId?: string;
  canView: boolean;
  error?: string | null;
}) => {
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);

  const resolveDocumentUrl = async (document: WorkspaceDocumentRow) => {
    if (document.pdfUrl) return document.pdfUrl;
    if (!organisationId) throw new Error('Organisation missing for document lookup.');
    const rendered = await getRenderedDocument(organisationId, document.documentId);
    const pdfUrl = (rendered as { pdfUrl?: unknown }).pdfUrl;
    if (typeof pdfUrl === 'string' && pdfUrl.trim()) return pdfUrl.trim();
    throw new Error('Document PDF is not available yet.');
  };

  const handleDocumentAction = async (document: WorkspaceDocumentRow) => {
    setDocumentError(null);
    try {
      const url = await resolveDocumentUrl(document);
      setPreview({ title: document.title, url });
    } catch (actionError) {
      console.error('Unable to open workspace document:', actionError);
      setDocumentError(
        actionError instanceof Error ? actionError.message : 'Unable to open document.'
      );
    }
  };

  return (
    <SectionContainer
      titleClassName="text-yc-20-b-primary"
      title="All Documents"
      className="flex flex-col gap-4"
    >
      {error && (
        <p role="alert" className="rounded-2xl bg-danger-100 p-4 text-body-4 text-danger-700">
          {error}
        </p>
      )}
      {!error && documents.length === 0 && (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          No documents recorded yet.
        </p>
      )}
      {!error && documents.length > 0 && (
        <div className="flex flex-col gap-3">
          <div
            className={`${DOCUMENT_ROW_GRID} hidden border border-transparent px-4 text-caption-2 font-medium tracking-wide text-text-secondary uppercase [&>span]:truncate sm:grid`}
          >
            <span>Created</span>
            <span>Source</span>
            <span>Title</span>
            <span>Status</span>
            <span>Signing</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="flex flex-col gap-3">
            {documents.map((document) => (
              <li
                key={document.documentId}
                className={`${DOCUMENT_ROW_GRID} rounded-2xl border border-card-border p-4`}
              >
                <span className="truncate text-body-4 text-text-secondary">
                  {formatDateTime(toIsoString(document.createdAt))}
                </span>
                <span>
                  <DocumentSourcePill source={document.sourceKind} />
                </span>
                <span className="truncate font-medium text-text-primary">{document.title}</span>
                <span className="truncate text-body-4 text-text-primary">
                  {humanizeToken(document.status)}
                </span>
                <span className="truncate text-body-4 text-text-secondary">
                  {humanizeToken(document.signingStatus)}
                </span>
                <div className="flex justify-end gap-2">
                  {canView && (
                    <>
                      <CircleIconButton
                        icon={<LuEye aria-hidden="true" />}
                        label={`View ${document.title}`}
                        variant="dark"
                        onClick={() => void handleDocumentAction(document)}
                      />
                      <CircleIconButton
                        icon={<LuDownload aria-hidden="true" />}
                        label={`Download ${document.title}`}
                        onClick={() => void handleDocumentAction(document)}
                      />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {documentError && (
            <p role="alert" className="rounded-2xl bg-danger-100 p-3 text-body-4 text-danger-700">
              {documentError}
            </p>
          )}
        </div>
      )}
      <PdfPreviewOverlay
        open={Boolean(preview)}
        title={preview?.title ?? 'Document'}
        pdfUrl={preview?.url ?? null}
        downloadLabel={`Download ${preview?.title ?? 'document'}`}
        onDownload={preview ? () => downloadDocumentUrl(preview.url) : undefined}
        onClose={() => setPreview(null)}
      />
    </SectionContainer>
  );
};

const SummaryStep = ({
  appointmentId,
  appointment,
  encounter,
  resolvedEncounterId,
}: SummaryStepProps) => {
  const setDischargeSummary = useAppointmentWorkspaceStore((s) => s.setDischargeSummary);
  const saveDischargeSummary = useAppointmentWorkspaceStore((s) => s.saveDischargeSummary);
  const reopenDischargeSummary = useAppointmentWorkspaceStore((s) => s.reopenDischargeSummary);
  const setFollowUp = useAppointmentWorkspaceStore((s) => s.setFollowUp);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const mergeEncounterData = useAppointmentWorkspaceStore((s) => s.mergeEncounterData);
  const openSigningOverlay = useSigningOverlayStore((s) => s.openOverlay);
  const setSigningUrl = useSigningOverlayStore((s) => s.setUrl);
  const closeSigningOverlay = useSigningOverlayStore((s) => s.close);
  const signingOverlayOpen = useSigningOverlayStore((s) => s.open);
  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [packetPreviewUrl, setPacketPreviewUrl] = useState<string | null>(null);
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateState, setTemplateState] = useState<{
    templates: TemplateLike[];
    error: string | null;
  }>({ templates: [], error: null });
  // The template the discharge summary was hydrated from (resolved by context or
  // chosen via search). Persisted alongside the artifact so the saved record
  // carries provenance (`templateId` + `templateVersion`).
  const [dischargeTemplate, setDischargeTemplate] = useState<{
    templateId: string;
    templateVersion: number;
    templateVersionId?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // The discharge summary becomes read-only once saved (or when the encounter
  // itself is view-only).
  const dischargeSaved = Boolean(encounter.dischargeSavedAt);
  const readOnly = encounter.viewOnly || dischargeSaved;
  const { can } = usePermissions(appointment?.organisationId);
  const canViewDocuments = can('document:view:any');
  // The All-Documents list comes from the backend documents read-model (same DTO
  // as the Records panel) rather than being rebuilt client-side from artifacts.
  const [documents, setDocuments] = useState<WorkspaceDocumentRow[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  // Backend encounter id discovered from the workspace bootstrap when neither the
  // appointment prop nor the parent-threaded id carry one yet (newly
  // hydrated/admitted visits). Acts as the last-resort fallback so the document,
  // sign, and print logic still has encounter context.
  const [hydratedEncounterId, setHydratedEncounterId] = useState<string | undefined>();
  // Packet-level signing truth captured from the reconcile response. Kept
  // alongside the documents-derived signal so the Sign→Download Signed swap fires
  // even before the per-document SIGNED status has propagated into the read-model.
  const [packetSigned, setPacketSigned] = useState(false);

  const templateSearchRef = useRef<HTMLDivElement>(null);
  const templateMatches = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return [];
    return templateState.templates.filter((template) => template.name.toLowerCase().includes(q));
  }, [templateQuery, templateState.templates]);

  useEffect(() => {
    if (!appointment?.organisationId) return;
    listDischargeSummaryTemplates(appointment.organisationId)
      .then((items) => {
        setTemplateState({ templates: items, error: null });
      })
      .catch((error) => {
        console.error('Unable to load discharge templates:', error);
        setTemplateState({ templates: [], error: 'Unable to load discharge templates.' });
      });
  }, [appointment?.organisationId]);

  // Auto-resolve the discharge template for this encounter's context
  // (service / package / species / mode) and prefill the rich-text editor. Runs
  // once per encounter, and only when the summary is still blank and unsaved so
  // it never clobbers a draft or a manually chosen template.
  const organisationId = appointment?.organisationId;
  // Resolve the encounter id from the hydrated sources first (parent lifecycle id,
  // then a bootstrap fallback) before falling back to the appointment prop, which
  // may predate bootstrap and carry no encounter id at all.
  const encounterId = resolvedEncounterId ?? appointment?.encounterId ?? hydratedEncounterId;

  // When no encounter id is available yet, hydrate it from the workspace bootstrap
  // so newly admitted/hydrated visits can still manage their clinical packet.
  useEffect(() => {
    if (!organisationId || !appointmentId || encounterId) return;
    let cancelled = false;
    getAppointmentWorkspaceBootstrap(organisationId, appointmentId)
      .then((bootstrap) => {
        if (cancelled) return;
        const bootstrapEncounterId = getBootstrapEncounterId(bootstrap);
        if (bootstrapEncounterId) setHydratedEncounterId(bootstrapEncounterId);
      })
      .catch((error) => {
        console.error('Unable to hydrate encounter id:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [organisationId, appointmentId, encounterId]);

  // Load (and expose a refetch of) the backend documents read-model for this
  // encounter. The refetch is reused after signing so the list, statuses, and
  // signing state stay in sync without a full page reload.
  const refreshDocuments = useCallback(async () => {
    if (!organisationId || !encounterId) return;
    try {
      const rows = await listEncounterWorkspaceDocuments(organisationId, encounterId);
      setDocuments(rows);
      setDocumentsError(null);
    } catch (error) {
      console.error('Unable to load documents:', error);
      setDocumentsError('Unable to load documents.');
    }
  }, [organisationId, encounterId]);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  // After a signing session closes, pull server truth so the documents list,
  // discharge artifact status, and finalization gate (ready-for-discharge /
  // ready-for-billing) reflect the completed Documenso signature.
  const refreshAfterSigning = useCallback(async () => {
    if (!organisationId || !appointmentId) return;
    // The Documenso completion webhook can't reach the backend in local/dev and
    // can lag in prod, so first ask the backend to reconcile the packet against
    // Documenso directly (pull the signed copy, mark packet + documents SIGNED).
    // Best-effort: if the reconcile endpoint isn't deployed yet (404) or signing
    // is genuinely incomplete, we swallow the error and fall through to the
    // bootstrap + documents refetch below, which still reflects webhook truth.
    const packetId = signingPacketIdRef.current;
    if (packetId) {
      try {
        const reconciled = await reconcileWorkspaceDocumentPacket(organisationId, packetId);
        if (reconciled?.signing?.status?.toUpperCase() === 'SIGNED') {
          setPacketSigned(true);
        }
      } catch (error) {
        console.error('Unable to reconcile packet signing:', error);
      }
    }
    try {
      const bootstrap = await getAppointmentWorkspaceBootstrap(organisationId, appointmentId);
      mergeEncounterData(appointmentId, normalizeWorkspaceBootstrapForEncounter(bootstrap));
    } catch (error) {
      console.error('Unable to refresh encounter after signing:', error);
    }
    await refreshDocuments();
  }, [organisationId, appointmentId, mergeEncounterData, refreshDocuments]);

  // The signing overlay has no completion callback, so treat closing it after a
  // sign was started as the signal to refetch (the Documenso webhook has run
  // server-side by then).
  const signingInitiatedRef = useRef(false);
  // The packet being signed, captured when signing starts so the post-close
  // reconcile can pull server-side signing truth from Documenso directly.
  const signingPacketIdRef = useRef<string | null>(null);
  const resolvedDischargeEncounterRef = useRef<string | null>(null);
  const dischargeResolveKey = encounterId ?? appointmentId;
  const companionId = appointment?.patient?.id;
  const companionSpecies = appointment?.patient?.species;
  const dischargeSummary = encounter.dischargeSummary;
  const encounterMode = encounter.mode;
  const encounterServices = encounter.services;
  const applyTemplateFollowUpDays = useCallback(
    (snapshot: TemplateSchemaSnapshot | undefined) => {
      const followUpInDays = extractFollowUpInDays(snapshot);
      if (!followUpInDays || encounter.followUpAt) return;
      const next = new Date();
      next.setDate(next.getDate() + followUpInDays);
      setFollowUp(appointmentId, next.toISOString());
    },
    [appointmentId, encounter.followUpAt, setFollowUp]
  );
  useEffect(() => {
    if (signingOverlayOpen || !signingInitiatedRef.current) return;
    signingInitiatedRef.current = false;
    void refreshAfterSigning();
  }, [signingOverlayOpen, refreshAfterSigning]);

  useEffect(() => {
    if (!organisationId || dischargeSaved) return;
    if (resolvedDischargeEncounterRef.current === dischargeResolveKey) return;
    if (!isRichTextEmpty(dischargeSummary) || dischargeTemplate) return;
    resolvedDischargeEncounterRef.current = dischargeResolveKey;
    let cancelled = false;
    const serviceLine = encounterServices?.find((item) => item.kind === 'SERVICE');
    const packageLine = encounterServices?.find((item) => item.kind === 'PACKAGE');
    resolveDischargeTemplate({
      organisationId,
      appointmentId,
      encounterId,
      companionId,
      species: companionSpecies,
      serviceId: serviceLine?.refId,
      packageId: packageLine?.refId,
      mode: encounterMode,
    })
      .then((resolved) => {
        if (cancelled || !resolved) return;
        const html = schemaSnapshotToDischargeHtml(resolved.schemaSnapshot);
        if (html) setDischargeSummary(appointmentId, html);
        setDischargeTemplate({
          templateId: resolved.templateId,
          templateVersion: resolved.templateVersion,
          templateVersionId: resolved.templateVersionId,
        });
        // The discharge template defines "follow up in N days"; prefill the follow-up date as
        // (today + N days) when the clinician has not already set one. It stays editable below.
        applyTemplateFollowUpDays(resolved.schemaSnapshot);
      })
      .catch((error) => {
        console.error('Unable to resolve discharge template:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [
    appointmentId,
    companionId,
    companionSpecies,
    dischargeResolveKey,
    dischargeSaved,
    dischargeSummary,
    dischargeTemplate,
    encounterId,
    encounterMode,
    encounterServices,
    organisationId,
    applyTemplateFollowUpDays,
    setDischargeSummary,
  ]);

  const handleTemplateSelect = (template: TemplateLike) => {
    const snapshot = getTemplateSchemaSnapshot(template);
    setDischargeSummary(appointmentId, schemaSnapshotToDischargeHtml(snapshot));
    setDischargeTemplate({
      templateId: template.id,
      templateVersion: template.publishedVersion ?? template.latestVersion,
    });
    applyTemplateFollowUpDays(snapshot);
    setTemplateQuery('');
  };

  // Build the merged clinical packet for this encounter and start signing it as
  // a single document via Documenso. The packet stays DRAFT until the Documenso
  // webhook confirms completion, at which point every bundled document is marked
  // signed against the one signed packet PDF.
  const handleSign = async () => {
    if (isSigning) return;
    if (!organisationId || !encounterId) {
      setSignError('Missing organisation or encounter for signing.');
      return;
    }

    setSignError(null);
    setIsSigning(true);
    openSigningOverlay(`packet-${encounterId}`);
    try {
      const packet = await createEncounterDocumentPacket(organisationId, encounterId);
      const packetId = packet?.packetId;
      if (!packetId) {
        throw new Error('Document packet could not be created.');
      }
      // Remember the packet so the post-close reconcile can resolve its signing
      // state against Documenso directly.
      signingPacketIdRef.current = packetId;
      const signed = await signWorkspaceDocumentPacket(organisationId, packetId, {
        signerName: encounter.leadName ?? undefined,
      });
      const signingUrl = signed?.signing?.signingUrl;
      if (!signingUrl) {
        throw new Error('Signing link is not available yet.');
      }
      setSigningUrl(signingUrl);
      // Arm the post-sign refresh: when the overlay closes we refetch documents,
      // discharge status, and the finalization gate.
      signingInitiatedRef.current = true;
      setStepStatus(appointmentId, 'SUMMARY', 'COMPLETED');
    } catch (error) {
      setSignError(error instanceof Error ? error.message : 'Unable to start signing.');
      closeSigningOverlay();
    } finally {
      setIsSigning(false);
    }
  };

  // Open the merged clinical packet (SOAP + Prescription + Discharge) as one PDF.
  // Falls back to the browser print dialog if the combined PDF isn't available
  // (e.g. documents not yet rendered, or no org/encounter context).
  const handlePrint = async () => {
    if (isPrinting) return;
    if (!organisationId || !encounterId) {
      globalThis.window.print();
      return;
    }
    setIsPrinting(true);
    try {
      const url = await getEncounterDocumentPacketPdfUrl(organisationId, encounterId);
      setPacketPreviewUrl(url);
    } catch {
      globalThis.window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const closePacketPreview = () => {
    setPacketPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    let persistedId: string | undefined;
    try {
      if (appointment?.organisationId) {
        const saved = await saveDischargeSummaryArtifact(
          {
            organisationId: appointment.organisationId,
            appointmentId,
            encounterId,
            dischargeSummaryId: encounter.dischargeSummaryId,
            templateId: dischargeTemplate?.templateId,
            templateVersion: dischargeTemplate?.templateVersion,
            templateVersionId: dischargeTemplate?.templateVersionId,
          },
          encounter.dischargeSummary,
          encounter.followUpAt
        );
        persistedId = (saved as { id?: string } | undefined)?.id;
      }
    } catch (error) {
      console.error('Unable to persist discharge summary:', error);
    } finally {
      saveDischargeSummary(appointmentId, encounter.leadName ?? 'Clinician', persistedId);
      setIsSaving(false);
    }
  };

  const handleFollowUpChange = (next: Date | null) => {
    setFollowUp(appointmentId, next ? next.toISOString() : undefined);
  };

  const followUpDate = toFollowUpDate(encounter.followUpAt);
  const showDocumentActions = dischargeSaved;

  // The packet is considered signed once any document in the encounter read-model
  // reports a SIGNED signing status — Documenso marks the bundled documents signed
  // against the one signed packet PDF. Drives the Sign→Download Signed swap and the
  // "print the signed copy" behaviour.
  const isPacketSigned = useMemo(
    () =>
      packetSigned ||
      documents.some((document) => document.signingStatus?.toUpperCase() === 'SIGNED'),
    [documents, packetSigned]
  );

  // Signing may only begin while the appointment is actively in progress; before
  // that (e.g. checked-in/upcoming) or after completion the action is disabled and
  // a tooltip explains why.
  const appointmentInProgress = appointment?.status === 'IN_PROGRESS';
  const signDisabled = encounter.viewOnly || isSigning || !appointmentInProgress;
  const signDisabledReason = appointmentInProgress
    ? undefined
    : 'Signing is available only while the appointment is In progress.';

  // Download the signed packet PDF (the packet endpoint returns the signed copy
  // server-side once signing has completed).
  const handleDownloadSigned = async () => {
    if (isPrinting) return;
    if (!organisationId || !encounterId) return;
    setIsPrinting(true);
    try {
      const url = await getEncounterDocumentPacketPdfUrl(organisationId, encounterId);
      downloadDocumentUrl(url);
      URL.revokeObjectURL(url);
    } catch (error) {
      setSignError(
        error instanceof Error ? error.message : 'Unable to download the signed document.'
      );
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <SigningOverlay />
      <PdfPreviewOverlay
        open={Boolean(packetPreviewUrl)}
        title="Clinical packet"
        pdfUrl={packetPreviewUrl}
        downloadLabel="Download clinical packet"
        onDownload={packetPreviewUrl ? () => downloadDocumentUrl(packetPreviewUrl) : undefined}
        onClose={closePacketPreview}
      />

      {/* Discharge-template search sits above the container (like the SOAP step's
          template search) — selecting a template fills the editor. */}
      <div className="relative flex justify-end">
        <div ref={templateSearchRef} className="relative w-full sm:max-w-90">
          <Search
            value={templateQuery}
            setSearch={setTemplateQuery}
            placeholder="Search discharge templates"
            label="Search discharge templates"
            className="w-full!"
          />
          <SearchResultsDropdown
            anchorRef={templateSearchRef}
            open={Boolean(templateQuery.trim()) && !templateState.error}
            onClose={() => setTemplateQuery('')}
          >
            {templateMatches.length > 0 ? (
              <ul>
                {templateMatches.map((template) => (
                  <WorkspaceSearchResultRow
                    key={template.id}
                    name={template.name}
                    leadingIcon={<LuSearch aria-hidden="true" className="shrink-0" />}
                    onSelect={() => handleTemplateSelect(template)}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-body-4 text-text-secondary">
                No discharge templates match this search.
              </p>
            )}
          </SearchResultsDropdown>
          {templateState.error && (
            <p className="mt-2 text-caption-1 text-danger-600">{templateState.error}</p>
          )}
        </div>
      </div>

      {/* Mirrors the SOAP step sections: title + inset rich-text editor only.
          Once saved, the editor is replaced by a read-only render of the summary
          with a fixed follow-up date and a "Saved on … by …" stamp. */}
      <SectionContainer titleClassName="text-yc-20-b-primary" title="Discharge Summary" compactTop>
        {dischargeSaved ? (
          <div className="relative">
            {/* Editable until the encounter is locked (window closed / completed /
                discharged). Absolutely positioned so it overlays the top-right
                without pushing the summary down a row. */}
            {!encounter.viewOnly && (
              <div className="absolute top-0 right-0 z-10">
                <CircleIconButton
                  icon={<LuPencil aria-hidden="true" />}
                  label="Edit discharge summary"
                  variant="dark"
                  onClick={() => reopenDischargeSummary(appointmentId)}
                />
              </div>
            )}
            <div
              className="text-body-4 leading-[150%] text-text-primary [&_li]:my-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 sm:pr-12"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichText(encounter.dischargeSummary ?? '') || '-',
              }}
            />
            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              {/* Same Datepicker container as edit mode, rendered non-interactive. */}
              <div
                className="pointer-events-none w-full select-none sm:max-w-72"
                aria-disabled="true"
              >
                <Datepicker
                  type="input"
                  currentDate={followUpDate}
                  setCurrentDate={() => undefined}
                  placeholder="Follow up date"
                />
              </div>
              <div className="flex flex-col items-end leading-[120%]">
                <span className="text-[12px] font-bold text-neutral-900">
                  Saved by {encounter.dischargeSavedByName}
                </span>
                <span className="text-[12px] font-medium text-text-brand">
                  {formatDateTime(encounter.dischargeSavedAt ?? '')}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <RichTextEditor
              ariaLabel="Discharge summary"
              value={encounter.dischargeSummary}
              readOnly={readOnly}
              toolbarPlacement="inset"
              onChange={(html) => setDischargeSummary(appointmentId, html)}
              placeholder="Discharge instructions and follow-up care"
            />
            <div className="mt-3 flex justify-end">
              <div
                className={`w-full sm:max-w-72 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}
                aria-disabled={readOnly}
              >
                <Datepicker
                  type="input"
                  currentDate={followUpDate}
                  setCurrentDate={
                    handleFollowUpChange as React.Dispatch<React.SetStateAction<Date | null>>
                  }
                  placeholder="Follow up date"
                />
              </div>
            </div>
          </>
        )}
      </SectionContainer>

      <div className="flex flex-col items-end gap-2">
        {signError && (
          <p role="alert" className="text-body-4 text-danger-700">
            {signError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {showDocumentActions && (
            <Secondary
              text={isPrinting ? 'Preparing…' : 'Print All'}
              icon={<LuPrinter aria-hidden="true" />}
              onClick={handlePrint}
              isDisabled={isPrinting}
            />
          )}
          {!dischargeSaved && (
            <Secondary
              text="Save"
              icon={<LuSave aria-hidden="true" />}
              onClick={handleSave}
              isDisabled={encounter.viewOnly || isSaving}
            />
          )}
          {showDocumentActions && isPacketSigned && (
            <Secondary
              text="Download Signed"
              icon={<LuDownload aria-hidden="true" />}
              onClick={handleDownloadSigned}
              isDisabled={isPrinting}
            />
          )}
          {showDocumentActions && !isPacketSigned && signDisabledReason && (
            <GlassTooltip content={signDisabledReason} side="top">
              <Secondary
                text={isSigning ? 'Signing…' : 'Sign'}
                icon={<LuFileSignature aria-hidden="true" />}
                onClick={handleSign}
                isDisabled={signDisabled}
              />
            </GlassTooltip>
          )}
          {showDocumentActions && !isPacketSigned && !signDisabledReason && (
            <Secondary
              text={isSigning ? 'Signing…' : 'Sign'}
              icon={<LuFileSignature aria-hidden="true" />}
              onClick={handleSign}
              isDisabled={signDisabled}
            />
          )}
        </div>
      </div>

      <AllDocumentsTable
        documents={documents}
        organisationId={organisationId}
        canView={canViewDocuments}
        error={documentsError}
      />
    </div>
  );
};

export default SummaryStep;
