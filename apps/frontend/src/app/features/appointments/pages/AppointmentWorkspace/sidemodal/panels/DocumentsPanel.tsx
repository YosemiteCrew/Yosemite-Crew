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
import type { Form } from '@yosemite-crew/types';
import TabToggle from '@/app/ui/primitives/TabToggle/TabToggle';
import Search from '@/app/ui/inputs/Search';
import { Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import SigningOverlay from '@/app/ui/overlays/SigningOverlay';
import CompanionDocumentsSection from '@/app/features/documents/components/CompanionDocumentsSection';
import { fetchAppointmentForms } from '@/app/features/forms/services/appointmentFormsService';
import { downloadSubmissionPdf } from '@/app/features/forms/services/formSigningService';
import {
  createEncounterDocumentPacket,
  getEncounterDocumentPacketPdfUrl,
  signWorkspaceDocumentPacket,
} from '@/app/features/appointments/services/workspaceAggregateService';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import { isAuthRedirectError } from '@/app/services/axios';

type DocumentsPanelProps = {
  appointmentId: string;
  companionId?: string;
  organisationId?: string;
  encounterId?: string;
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
const ClinicalPacketSection = ({
  organisationId,
  encounterId,
}: {
  organisationId?: string;
  encounterId?: string;
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

  useEffect(() => {
    if (signingOverlayOpen || !signingInitiatedRef.current) return;
    signingInitiatedRef.current = false;
    void refreshPacket();
  }, [refreshPacket, signingOverlayOpen]);

  const isSigned = packet?.signingStatus === 'SIGNED';
  const isInProgress = packet?.signingStatus === 'IN_PROGRESS';
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

  let signLabel = 'Sign';
  if (isSigned) signLabel = 'Signed';
  else if (isInProgress) signLabel = 'Signing in progress';
  else if (isSigning) signLabel = 'Signing…';

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
        <Secondary
          text={signLabel}
          icon={<LuFileSignature aria-hidden="true" />}
          onClick={() => void handleSign()}
          isDisabled={!hasContext || isSigning || isSigned || isInProgress}
        />
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
        No forms match this search.
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
}: {
  appointmentId: string;
  organisationId?: string;
  encounterId?: string;
}) => {
  const initialAppointmentId = useRef(appointmentId);
  const [query, setQuery] = useState('');
  const [forms, setForms] = useState<SubmittedForm[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchAppointmentForms(initialAppointmentId.current).then(
      (response) => {
        if (cancelled) return;
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
      },
      (error) => {
        if (cancelled) return;
        if (!isAuthRedirectError(error)) {
          console.error('Unable to load appointment forms:', error);
        }
        setStatus('error');
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredForms = useMemo(
    () => forms.filter((f) => f.title.toLowerCase().includes(query.trim().toLowerCase())),
    [forms, query]
  );

  return (
    <div
      id="docs-panel-FORMS"
      role="tabpanel"
      aria-labelledby="tab-FORMS"
      className="flex flex-col gap-3"
    >
      <ClinicalPacketSection organisationId={organisationId} encounterId={encounterId} />
      <Search
        value={query}
        setSearch={setQuery}
        placeholder="Search forms to add"
        label="Search forms to add"
        className="w-full!"
      />
      {renderFormsPanelContent(status, filteredForms)}
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
