'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuAlertCircle,
  LuCheckCircle,
  LuDownload,
  LuEye,
  LuFileSignature,
  LuPrinter,
} from 'react-icons/lu';
import type { Appointment, Form, TemplateLike } from '@yosemite-crew/types';

type AppointmentStatus = Appointment['status'];
import TabToggle from '@/app/ui/primitives/TabToggle/TabToggle';
import Search from '@/app/ui/inputs/Search';
import { Secondary } from '@/app/ui/primitives/Buttons';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import SigningOverlay from '@/app/ui/overlays/SigningOverlay';
import CompanionDocumentsSection from '@/app/features/documents/components/CompanionDocumentsSection';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import WorkspaceSearchResultRow from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceSearchResultRow';
import {
  fetchAppointmentForms,
  linkAppointmentForms,
} from '@/app/features/forms/services/appointmentFormsService';
import { loadTemplateForms } from '@/app/features/forms/services/templateFormsService';
import { downloadSubmissionPdf } from '@/app/features/forms/services/formSigningService';
import {
  createEncounterDocumentPacket,
  getEncounterDocumentPacketPdfUrl,
  reconcileWorkspaceDocumentPacket,
  signWorkspaceDocumentPacket,
} from '@/app/features/appointments/services/workspaceAggregateService';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import { isAuthRedirectError } from '@/app/services/axios';

type DocumentsPanelProps = {
  appointmentId: string;
  companionId?: string;
  organisationId?: string;
  encounterId?: string;
  appointmentStatus?: AppointmentStatus;
};

type DocsTab = 'FORMS' | 'RECORDS';

const TABS = [
  { key: 'FORMS', label: 'Forms' },
  { key: 'RECORDS', label: 'Records' },
];

// A staff (Internal) form is authored/signed by the service provider; a parent
// (External) consent form is acknowledged by the client. The signing-state badge
// therefore depends on both the audience and whether the form is complete.
type FormAudience = 'STAFF' | 'PARENT';
type FormAuthState = 'AUTHORIZED_CLIENT' | 'AUTHORIZED_PROVIDER' | 'PENDING';

type SubmittedForm = {
  id: string;
  title: string;
  audience: FormAudience;
  auth: FormAuthState;
  date: string;
  time: string;
  /** Backend submission id, present once the parent has submitted — enables PDF download. */
  submissionId?: string;
};

const AUTH_META: Record<FormAuthState, { label: string; tone: string; icon: React.ReactNode }> = {
  AUTHORIZED_CLIENT: {
    label: 'Authorized by Client',
    tone: 'text-success-600',
    icon: <LuCheckCircle size={14} aria-hidden="true" />,
  },
  AUTHORIZED_PROVIDER: {
    label: 'Authorized by Service Provider',
    tone: 'text-success-600',
    icon: <LuCheckCircle size={14} aria-hidden="true" />,
  },
  PENDING: {
    label: 'Acknowledgement pending',
    tone: 'text-danger-600',
    icon: <LuAlertCircle size={14} aria-hidden="true" />,
  },
};

const AUDIENCE_META: Record<FormAudience, string> = {
  STAFF: 'Staff form',
  PARENT: 'Parent consent',
};

// The workspace forms search assigns questionnaire-style templates to the
// appointment — consent forms and custom (FORM) templates. Clinical artifact
// kinds (SOAP, vitals, prescription, discharge) and plan-definition kinds
// (tasks, inpatient schedule) are authored elsewhere in the workspace and must
// never appear here, so we allow-list only the two assignable kinds.
const ASSIGNABLE_FORM_KINDS = new Set<TemplateLike['kind']>(['FORM', 'CONSENT']);

// Only published templates can be filled/signed by a client, so drafts and
// archived templates are excluded from the assignable list.
const isAssignableFormTemplate = (template: TemplateLike): boolean =>
  ASSIGNABLE_FORM_KINDS.has(template.kind) &&
  template.status === 'PUBLISHED' &&
  Boolean(template.id);

// Internal forms are completed by the practice (staff); External forms are sent
// to the pet parent for consent. `visibilityType` is the authoritative signal;
// fall back to the category label for older payloads that only set the category.
const resolveFormAudience = (form: Form): FormAudience => {
  if (form.visibilityType === 'External') return 'PARENT';
  if (form.visibilityType === 'Internal') return 'STAFF';
  return /consent/i.test(form.category ?? '') ? 'PARENT' : 'STAFF';
};

// A completed staff form is authorized by the provider; a completed parent form
// is authorized by the client; anything not yet complete is pending.
const resolveFormAuth = (audience: FormAudience, completed: boolean): FormAuthState => {
  if (!completed) return 'PENDING';
  return audience === 'STAFF' ? 'AUTHORIZED_PROVIDER' : 'AUTHORIZED_CLIENT';
};

// Plain-label packet status so raw enums never reach the UI.
const PACKET_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  FINAL: 'Final',
};

const SIGNING_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'Signing in progress',
  SIGNED: 'Signed',
};

const formatDate = (value: Date | string | undefined) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (value: Date | string | undefined) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const StateBadge = ({ label, tone }: { label: string; tone: string }) => (
  <span
    className={`inline-flex items-center rounded-2xl border border-card-border bg-[#FAF8F6] px-3 py-1 text-[12px] ${tone}`}
  >
    {label}
  </span>
);

type PacketState = {
  packetId?: string;
  status?: string;
  signingStatus?: string;
};

/**
 * Combined clinical packet (SOAP + Prescription + Discharge) surfaced at parity
 * with the Summary step. Reuses the shared aggregate-service exports — Print via
 * `getEncounterDocumentPacketPdfUrl` into the existing PdfPreviewOverlay, and
 * Sign via `createEncounterDocumentPacket` + `signWorkspaceDocumentPacket` into
 * the existing SigningOverlay. The packet/signing state matrix is rendered as
 * plain-label badges and gates the Sign action.
 */
const resolveSignLabel = ({
  isSigned,
  isInProgress,
  isSigning,
}: {
  isSigned: boolean;
  isInProgress: boolean;
  isSigning: boolean;
}): string => {
  if (isSigned) return 'Signed';
  if (isInProgress) return 'Signing in progress';
  if (isSigning) return 'Signing…';
  return 'Sign';
};

const ClinicalPacketSection = ({
  organisationId,
  encounterId,
  appointmentStatus,
}: {
  organisationId?: string;
  encounterId?: string;
  appointmentStatus?: AppointmentStatus;
}) => {
  const openSigningOverlay = useSigningOverlayStore((s) => s.openOverlay);
  const setSigningUrl = useSigningOverlayStore((s) => s.setUrl);
  const closeSigningOverlay = useSigningOverlayStore((s) => s.close);
  const signingOverlayOpen = useSigningOverlayStore((s) => s.open);
  const [packet, setPacket] = useState<PacketState | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [packetPreviewUrl, setPacketPreviewUrl] = useState<string | null>(null);
  // The packet only exists with org + encounter context; without it the actions
  // are disabled (mirrors SummaryStep's fallbacks).
  const hasContext = Boolean(organisationId && encounterId);

  // Resolve the encounter's packet on mount so the state matrix reflects server
  // truth. `createEncounterDocumentPacket` is idempotent — it returns the
  // existing packet (with its status + signing state) when one is present.
  const refreshPacket = useCallback(async () => {
    if (!organisationId || !encounterId) return;
    try {
      const result = await createEncounterDocumentPacket(organisationId, encounterId);
      setPacket({
        packetId: result?.packetId,
        status: result?.status,
        signingStatus: result?.signing?.status,
      });
    } catch (error) {
      if (!isAuthRedirectError(error)) {
        console.error('Unable to load clinical packet:', error);
      }
    }
  }, [organisationId, encounterId]);

  useEffect(() => {
    void refreshPacket();
  }, [refreshPacket]);

  const signingInitiatedRef = useRef(false);
  // The packet being signed, captured when signing starts so the post-close
  // reconcile can resolve its signing state against Documenso directly.
  const signingPacketIdRef = useRef<string | null>(null);

  // When the signing overlay closes after a sign was started, reconcile the
  // packet against Documenso (webhook can't reach the backend in local/dev and
  // can lag in prod), then refetch so the Sign→Download Signed swap and the
  // Draft→Final / Signed badges reflect the completed signature. Best-effort:
  // if the reconcile endpoint isn't deployed yet the refetch still applies
  // webhook truth.
  useEffect(() => {
    if (signingOverlayOpen || !signingInitiatedRef.current) return;
    signingInitiatedRef.current = false;
    const packetId = signingPacketIdRef.current;
    void (async () => {
      if (packetId && organisationId) {
        try {
          await reconcileWorkspaceDocumentPacket(organisationId, packetId);
        } catch (error) {
          if (!isAuthRedirectError(error)) {
            console.error('Unable to reconcile packet signing:', error);
          }
        }
      }
      await refreshPacket();
    })();
  }, [organisationId, refreshPacket, signingOverlayOpen]);

  const isSigned = packet?.signingStatus === 'SIGNED';
  const isInProgress = packet?.signingStatus === 'IN_PROGRESS';
  // Signing may only begin while the appointment is actively in progress; before
  // that (e.g. checked-in/upcoming) or after completion the action is disabled and
  // a tooltip explains why (mirrors SummaryStep).
  const appointmentInProgress = appointmentStatus === 'IN_PROGRESS';
  const signGateReason =
    appointmentInProgress || isSigned || isInProgress
      ? undefined
      : 'Signing is available only while the appointment is In progress.';
  const statusLabel = packet?.status ? (PACKET_STATUS_LABEL[packet.status] ?? null) : null;
  const signingLabel = packet?.signingStatus
    ? (SIGNING_STATUS_LABEL[packet.signingStatus] ?? null)
    : null;

  const handlePrint = async () => {
    if (!organisationId || !encounterId || isPrinting) return;
    setIsPrinting(true);
    try {
      const url = await getEncounterDocumentPacketPdfUrl(organisationId, encounterId);
      setPacketPreviewUrl(url);
    } catch (error) {
      console.error('Unable to open the clinical packet:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadSigned = async () => {
    if (!organisationId || !encounterId || isPrinting) return;
    setIsPrinting(true);
    try {
      const url = await getEncounterDocumentPacketPdfUrl(organisationId, encounterId);
      downloadPacket(url);
      URL.revokeObjectURL(url);
    } catch (error) {
      setSignError(
        error instanceof Error ? error.message : 'Unable to download the signed document.'
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSign = async () => {
    if (!organisationId || !encounterId || isSigning || isSigned) return;
    setSignError(null);
    setIsSigning(true);
    openSigningOverlay(`packet-${encounterId}`);
    try {
      const created = await createEncounterDocumentPacket(organisationId, encounterId);
      const packetId = created?.packetId;
      if (!packetId) {
        throw new Error('Document packet could not be created.');
      }
      signingPacketIdRef.current = packetId;
      const signed = await signWorkspaceDocumentPacket(organisationId, packetId);
      const signingUrl = signed?.signing?.signingUrl;
      if (!signingUrl) {
        throw new Error('Signing link is not available yet.');
      }
      setSigningUrl(signingUrl);
      setPacket({
        packetId,
        status: signed?.status ?? created?.status,
        signingStatus: signed?.signing?.status ?? 'IN_PROGRESS',
      });
      signingInitiatedRef.current = true;
    } catch (error) {
      setSignError(error instanceof Error ? error.message : 'Unable to start signing.');
      closeSigningOverlay();
    } finally {
      setIsSigning(false);
    }
  };

  const closePacketPreview = () => {
    setPacketPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const downloadPacket = (url: string) => {
    const link = globalThis.document.createElement('a');
    link.href = url;
    link.download = '';
    link.rel = 'noopener noreferrer';
    globalThis.document.body.append(link);
    link.click();
    link.remove();
  };

  const signLabel = resolveSignLabel({ isSigned, isInProgress, isSigning });

  return (
    <section
      aria-label="Clinical packet"
      className="flex flex-col gap-3 rounded-2xl border border-card-border p-4"
    >
      <SigningOverlay />
      <PdfPreviewOverlay
        open={Boolean(packetPreviewUrl)}
        title="Clinical packet"
        pdfUrl={packetPreviewUrl}
        downloadLabel="Download clinical packet"
        onDownload={packetPreviewUrl ? () => downloadPacket(packetPreviewUrl) : undefined}
        onClose={closePacketPreview}
      />
      <div className="flex flex-col gap-1">
        <span className="text-body-4 font-medium text-text-primary">Clinical packet</span>
        <span className="text-[12px] text-text-secondary">
          Combined SOAP, prescription and discharge documents.
        </span>
      </div>
      {hasContext ? (
        <div className="flex flex-wrap items-center gap-2">
          {statusLabel && <StateBadge label={statusLabel} tone="text-text-primary" />}
          {signingLabel && (
            <StateBadge
              label={signingLabel}
              tone={isSigned ? 'text-success-600' : 'text-text-secondary'}
            />
          )}
        </div>
      ) : (
        <p className="text-[12px] text-text-secondary">
          Open this from an encounter to print or sign the combined packet.
        </p>
      )}
      {signError && (
        <p role="alert" className="text-[12px] text-danger-600">
          {signError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Secondary
          text={isPrinting ? 'Preparing…' : 'Print All'}
          icon={<LuPrinter aria-hidden="true" />}
          onClick={() => void handlePrint()}
          isDisabled={!hasContext || isPrinting}
        />
        {isSigned && (
          <Secondary
            text="Download Signed"
            icon={<LuDownload aria-hidden="true" />}
            onClick={() => void handleDownloadSigned()}
            isDisabled={!hasContext || isPrinting}
          />
        )}
        {!isSigned &&
          (signGateReason ? (
            <GlassTooltip content={signGateReason} side="top">
              <Secondary
                text={signLabel}
                icon={<LuFileSignature aria-hidden="true" />}
                onClick={() => void handleSign()}
                isDisabled
              />
            </GlassTooltip>
          ) : (
            <Secondary
              text={signLabel}
              icon={<LuFileSignature aria-hidden="true" />}
              onClick={() => void handleSign()}
              isDisabled={!hasContext || isSigning || isInProgress}
            />
          ))}
      </div>
    </section>
  );
};

const renderFormsPanelContent = (
  status: 'loading' | 'loaded' | 'error',
  filteredForms: SubmittedForm[]
) => {
  if (status === 'loading') {
    return <p className="py-6 text-center text-body-4 text-text-secondary">Loading forms...</p>;
  }
  if (status === 'error') {
    return (
      <p className="py-6 text-center text-body-4 text-danger-600">
        Unable to load forms. Try again later.
      </p>
    );
  }
  if (filteredForms.length === 0) {
    return (
      <p className="py-6 text-center text-body-4 text-text-secondary">
        No forms assigned yet. Use the search above to add a consent or custom form.
      </p>
    );
  }
  return (
    <ul className="rounded-2xl border border-card-border px-4">
      {filteredForms.map((form) => (
        <FormRow key={form.id} form={form} />
      ))}
    </ul>
  );
};

const FormRow = ({ form }: { form: SubmittedForm }) => {
  const meta = AUTH_META[form.auth];
  const isPending = form.auth === 'PENDING';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A completed submission has a backend submission id we can render to PDF.
  // Pending forms have nothing to download yet, so the action is disabled.
  const canDownload = !isPending && Boolean(form.submissionId);

  const handleDownload = async () => {
    if (!form.submissionId || busy) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await downloadSubmissionPdf(form.submissionId);
      const url = URL.createObjectURL(blob);
      globalThis.window.open(url, '_blank', 'noopener');
      // Revoke shortly after so the new tab has time to load the blob.
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (downloadError) {
      console.error('Unable to download the signed form:', downloadError);
      setError('Unable to download this form. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-1 border-b border-card-border py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 leading-[130%]">
          <span className="text-body-4 font-medium text-text-primary">{form.title}</span>
          <span className="text-[12px] text-text-secondary">{AUDIENCE_META[form.audience]}</span>
          <span className={`flex items-center gap-1 text-[12px] ${meta.tone}`}>
            {meta.icon}
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-[120%] text-[12px] text-pill-success-text">
            <span>{form.date}</span>
            <span>{form.time}</span>
          </div>
          <CircleIconButton
            icon={
              isPending ? (
                <LuEye size={16} aria-hidden="true" />
              ) : (
                <LuDownload size={16} aria-hidden="true" />
              )
            }
            label={
              isPending ? `Awaiting parent submission for ${form.title}` : `Download ${form.title}`
            }
            variant="dark"
            disabled={!canDownload || busy}
            onClick={() => void handleDownload()}
          />
          <CircleIconButton
            icon={<LuPrinter size={16} aria-hidden="true" />}
            label={`Print ${form.title}`}
            disabled={!canDownload || busy}
            onClick={() => void handleDownload()}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-danger-600">
          {error}
        </p>
      )}
    </li>
  );
};

const AppointmentFormsPanel = ({
  appointmentId,
  organisationId,
  encounterId,
  appointmentStatus,
}: {
  appointmentId: string;
  organisationId?: string;
  encounterId?: string;
  appointmentStatus?: AppointmentStatus;
}) => {
  const initialAppointmentId = useRef(appointmentId);
  const [query, setQuery] = useState('');
  const [forms, setForms] = useState<SubmittedForm[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  // Assignable form templates (consent + custom forms) the clinician can attach
  // to this appointment from the search dropdown, mirroring the pre-revamp
  // side-modal flow. Loaded once org context is available.
  const [templates, setTemplates] = useState<TemplateLike[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const searchAnchorRef = useRef<HTMLDivElement>(null);

  const loadForms = useCallback(async () => {
    try {
      const response = await fetchAppointmentForms(initialAppointmentId.current);
      setForms(
        response.forms.map(({ form, submission, status: formStatus }) => {
          const updatedAt = form.updatedAt ?? form.createdAt;
          const audience = resolveFormAudience(form);
          return {
            id: submission?._id ?? form._id ?? form.name,
            title: form.name,
            audience,
            auth: resolveFormAuth(audience, formStatus === 'completed'),
            date: formatDate(updatedAt),
            time: formatTime(updatedAt),
            submissionId: submission?._id,
          };
        })
      );
      setStatus('loaded');
    } catch (error) {
      if (!isAuthRedirectError(error)) {
        console.error('Unable to load appointment forms:', error);
      }
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  // Load the org's assignable form templates (consent + custom forms only —
  // clinical artifacts and plan definitions are excluded) so the search can
  // surface everything available to attach to this appointment.
  useEffect(() => {
    if (!organisationId) return;
    let cancelled = false;
    loadTemplateForms(organisationId, { status: 'PUBLISHED' })
      .then((items) => {
        if (cancelled) return;
        setTemplates(items.filter(isAssignableFormTemplate));
      })
      .catch((error) => {
        if (!isAuthRedirectError(error)) {
          console.error('Unable to load assignable form templates:', error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organisationId]);

  // Titles already assigned to this appointment — hidden from the search results
  // so the clinician can't attach the same form twice.
  const assignedTitles = useMemo(
    () => new Set(forms.map((f) => f.title.trim().toLowerCase())),
    [forms]
  );

  // Whether the search input is focused. Focusing the field surfaces the full
  // list of assignable forms (like the pre-revamp side-modal), so the clinician
  // can browse without having to type a query first.
  const [searchFocused, setSearchFocused] = useState(false);

  const templateMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const unassigned = templates.filter(
      (template) => !assignedTitles.has(template.name.trim().toLowerCase())
    );
    // Empty query → show everything available so the dropdown is never blank when
    // the org actually has assignable forms.
    if (!q) return unassigned;
    return unassigned.filter((template) => template.name.toLowerCase().includes(q));
  }, [query, templates, assignedTitles]);

  const dropdownOpen = Boolean(organisationId) && (Boolean(query.trim()) || searchFocused);

  const handleAssignTemplate = async (template: TemplateLike) => {
    if (!organisationId || assigningId) return;
    setAssignError(null);
    setAssigningId(template.id);
    try {
      await linkAppointmentForms({
        organisationId,
        appointmentId: initialAppointmentId.current,
        formIds: [template.id],
      });
      setQuery('');
      await loadForms();
    } catch (error) {
      if (!isAuthRedirectError(error)) {
        console.error('Unable to assign form:', error);
      }
      setAssignError('Unable to assign this form. Please try again.');
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div
      id="docs-panel-FORMS"
      role="tabpanel"
      aria-labelledby="tab-FORMS"
      className="flex flex-col gap-3"
    >
      <ClinicalPacketSection
        organisationId={organisationId}
        encounterId={encounterId}
        appointmentStatus={appointmentStatus}
      />
      <div ref={searchAnchorRef} className="relative">
        <Search
          value={query}
          setSearch={setQuery}
          onFocus={() => setSearchFocused(true)}
          placeholder="Search forms to add"
          label="Search forms to add"
          className="w-full!"
        />
        <SearchResultsDropdown
          anchorRef={searchAnchorRef}
          open={dropdownOpen}
          onClose={() => {
            setQuery('');
            setSearchFocused(false);
          }}
        >
          {templateMatches.length > 0 ? (
            <ul>
              {templateMatches.map((template) => (
                <WorkspaceSearchResultRow
                  key={template.id}
                  name={template.name}
                  leadingIcon={<LuFileSignature aria-hidden="true" className="shrink-0" />}
                  disabled={assigningId === template.id}
                  onSelect={() => void handleAssignTemplate(template)}
                />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-body-4 text-text-secondary">
              {query.trim()
                ? 'No forms available to add for this search.'
                : 'No assignable forms available to add.'}
            </p>
          )}
        </SearchResultsDropdown>
      </div>
      {assignError && (
        <p role="alert" className="text-[12px] text-danger-600">
          {assignError}
        </p>
      )}
      {renderFormsPanelContent(status, forms)}
    </div>
  );
};

/** Documents panel: Forms (combined clinical packet + submitted forms with auth
 *  states) and Records (companion records). */
const DocumentsPanel = ({
  appointmentId,
  companionId,
  organisationId,
  encounterId,
  appointmentStatus,
}: DocumentsPanelProps) => {
  const [tab, setTab] = useState<DocsTab>('FORMS');

  return (
    <div className="flex flex-col gap-4">
      <TabToggle
        tabs={TABS}
        activeKey={tab}
        onChange={(key) => setTab(key as DocsTab)}
        panelId={(key) => `docs-panel-${key}`}
      />
      {tab === 'FORMS' ? (
        <AppointmentFormsPanel
          key={appointmentId}
          appointmentId={appointmentId}
          organisationId={organisationId}
          encounterId={encounterId}
          appointmentStatus={appointmentStatus}
        />
      ) : (
        <div id="docs-panel-RECORDS" role="tabpanel" aria-labelledby="tab-RECORDS">
          {companionId ? (
            <CompanionDocumentsSection companionId={companionId} />
          ) : (
            <p className="py-6 text-center text-body-4 text-text-secondary">
              No companion records available.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentsPanel;
