'use client';

import { useCallback, useEffect, useReducer, useState, type FormEvent } from 'react';
import { IoDocumentTextOutline, IoPrintOutline } from 'react-icons/io5';
import { Textarea } from '@/app/ui/Input';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { cardClass } from '@/app/features/companionHistory/components/clinicalListStyles';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useNotify } from '@/app/hooks/useNotify';
import {
  createMedicalCertificate,
  fetchMedicalCertificates,
  issueMedicalCertificate,
  revokeMedicalCertificate,
  type CreateMedicalCertificateInput,
  type MedicalCertificate,
  type MedicalCertificateType,
} from '@/app/features/companionHistory/services/medicalCertificateService';

const CERTIFICATE_TYPES: { value: MedicalCertificateType; label: string }[] = [
  { value: 'HEALTH_CERTIFICATE', label: 'Health certificate' },
  { value: 'VACCINATION_CERTIFICATE', label: 'Vaccination certificate' },
  { value: 'FIT_FOR_TRAVEL', label: 'Fit for travel' },
  { value: 'EXPORT_CERTIFICATE', label: 'Export certificate' },
  { value: 'BOARDING_CLEARANCE', label: 'Boarding clearance' },
  { value: 'BREEDING_CLEARANCE', label: 'Breeding clearance' },
  { value: 'OTHER', label: 'Other' },
];
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});
const LOAD_ERROR = 'Could not load medical certificates. Please try again.';

const typeLabel = (type: MedicalCertificateType): string =>
  CERTIFICATE_TYPES.find((item) => item.value === type)?.label ?? 'Medical certificate';
const dateLabel = (date: string | null): string =>
  date ? DATE_FORMATTER.format(new Date(date)) : '—';
const statusLabel = (status: MedicalCertificate['status']): string =>
  status.charAt(0) + status.slice(1).toLowerCase();
const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char];
  });

const printCertificate = (certificate: MedicalCertificate, patientName: string): void => {
  const popup = globalThis.window.open('', '_blank');
  if (!popup) throw new Error('Allow pop-ups to print this certificate.');
  popup.opener = null;
  const rows = [
    ['Patient', patientName],
    ['Certificate', typeLabel(certificate.certificateType)],
    ['Certificate number', certificate.issueNumber ?? ''],
    ['Issued', dateLabel(certificate.issuedAt)],
    ['Valid until', dateLabel(certificate.expiresAt)],
    ['Valid for travel', certificate.validForTravel ? 'Yes' : ''],
    ['Destination', certificate.destinationCountry ?? ''],
    ['Clinical findings', certificate.clinicalFindings ?? ''],
    ['Restrictions', certificate.restrictions ?? ''],
    ['Notes', certificate.notes ?? ''],
    ['Issued by', certificate.issuedBy ?? ''],
  ];
  let content = '';
  for (const [label, value] of rows) {
    if (value) {
      content += `<section><h2>${escapeHtml(label)}</h2><p>${escapeHtml(value)}</p></section>`;
    }
  }
  popup.document.documentElement.innerHTML = `<head><meta charset="utf-8"><title>${escapeHtml(typeLabel(certificate.certificateType))}</title><style>body{font:16px system-ui,sans-serif;color:CanvasText;margin:48px auto;max-width:720px;padding:0 24px}h1{font-size:28px}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:GrayText}section{border-bottom:1px solid ButtonBorder;padding:10px 0;white-space:pre-wrap}@media print{body{margin:18mm auto}}</style></head><body><h1>${escapeHtml(typeLabel(certificate.certificateType))}</h1>${content}</body>`;
  popup.print();
};

type DraftState = {
  certificateType: MedicalCertificateType;
  findings: string;
  restrictions: string;
  notes: string;
  destinationCountry: string;
  validForTravel: boolean;
};
const EMPTY_DRAFT: DraftState = {
  certificateType: 'HEALTH_CERTIFICATE',
  findings: '',
  restrictions: '',
  notes: '',
  destinationCountry: '',
  validForTravel: false,
};
type DraftAction = { type: 'change'; patch: Partial<DraftState> } | { type: 'reset' };
const draftReducer = (state: DraftState, action: DraftAction): DraftState =>
  action.type === 'reset' ? EMPTY_DRAFT : { ...state, ...action.patch };

const createInput = (
  state: DraftState,
  patientId: string,
  clientId: string
): CreateMedicalCertificateInput => ({
  patientId,
  clientId,
  certificateType: state.certificateType,
  validForTravel: state.validForTravel,
  ...(state.destinationCountry.trim()
    ? { destinationCountry: state.destinationCountry.trim() }
    : {}),
  ...(state.findings.trim() ? { clinicalFindings: state.findings.trim() } : {}),
  ...(state.restrictions.trim() ? { restrictions: state.restrictions.trim() } : {}),
  ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
});

type DraftTextareaProps = {
  label: string;
  name: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
};
const DraftTextarea = ({ label, name, value, maxLength, onChange }: DraftTextareaProps) => (
  <label className="grid gap-1 text-sm font-medium text-[var(--ink)] sm:col-span-2">
    {label}
    <Textarea
      name={name}
      className="min-h-16 rounded-lg border border-[var(--divider)] bg-card px-3 py-2"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={maxLength}
    />
  </label>
);

type CertificateDraftFormProps = {
  companionId: string;
  clientId: string;
  onCreated: (certificate: MedicalCertificate) => void;
};
const CertificateDraftForm = ({ companionId, clientId, onCreated }: CertificateDraftFormProps) => {
  const { notify } = useNotify();
  const [draft, dispatch] = useReducer(draftReducer, EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      onCreated(await createMedicalCertificate(createInput(draft, companionId, clientId)));
      dispatch({ type: 'reset' });
      notify('success', {
        title: 'Draft saved',
        text: 'The medical certificate is ready to review.',
      });
    } catch {
      notify('error', { title: 'Could not save draft', text: 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      className="grid gap-3 rounded-xl border border-[var(--divider)] p-3 sm:grid-cols-2"
      onSubmit={handleCreate}
    >
      <label className="grid gap-1 text-sm font-medium text-[var(--ink)]">
        {'Certificate type'}
        <select
          name="certificateType"
          className="rounded-lg border border-[var(--divider)] bg-card px-3 py-2"
          value={draft.certificateType}
          onChange={(event) =>
            dispatch({
              type: 'change',
              patch: { certificateType: event.target.value as MedicalCertificateType },
            })
          }
        >
          {CERTIFICATE_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          name="validForTravel"
          checked={draft.validForTravel}
          onChange={(event) =>
            dispatch({ type: 'change', patch: { validForTravel: event.target.checked } })
          }
        />
        {'Valid for travel'}
      </label>
      {draft.validForTravel ? (
        <label className="grid gap-1 text-sm font-medium text-[var(--ink)] sm:col-span-2">
          {'Destination country'}
          <input
            name="destinationCountry"
            className="rounded-lg border border-[var(--divider)] bg-card px-3 py-2"
            value={draft.destinationCountry}
            onChange={(event) =>
              dispatch({ type: 'change', patch: { destinationCountry: event.target.value } })
            }
            maxLength={100}
          />
        </label>
      ) : null}
      <DraftTextarea
        label="Clinical findings"
        name="clinicalFindings"
        value={draft.findings}
        maxLength={4000}
        onChange={(findings) => dispatch({ type: 'change', patch: { findings } })}
      />
      <DraftTextarea
        label="Restrictions"
        name="restrictions"
        value={draft.restrictions}
        maxLength={2000}
        onChange={(restrictions) => dispatch({ type: 'change', patch: { restrictions } })}
      />
      <DraftTextarea
        label="Notes"
        name="notes"
        value={draft.notes}
        maxLength={2000}
        onChange={(notes) => dispatch({ type: 'change', patch: { notes } })}
      />
      <div className="sm:col-span-2">
        <Primary type="submit" isDisabled={saving} text={saving ? 'Saving…' : 'Save draft'} />
      </div>
    </form>
  );
};

type CertificateCardProps = {
  certificate: MedicalCertificate;
  canEdit: boolean;
  busy: boolean;
  onIssue: (certificate: MedicalCertificate) => void;
  onPrint: (certificate: MedicalCertificate) => void;
  onRevoke: (certificate: MedicalCertificate) => void;
};
const CertificateCard = ({
  certificate,
  canEdit,
  busy,
  onIssue,
  onPrint,
  onRevoke,
}: CertificateCardProps) => (
  <li className="rounded-xl border border-[var(--divider)] p-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-[var(--ink)]">
          {typeLabel(certificate.certificateType)}
        </h3>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          {statusLabel(certificate.status)} · Created {dateLabel(certificate.createdAt)}
          {certificate.issueNumber ? ` · ${certificate.issueNumber}` : ''}
        </p>
        {certificate.destinationCountry ? (
          <p className="mt-2 text-sm text-[var(--ink-body)]">
            Destination: {certificate.destinationCountry}
          </p>
        ) : null}
        {certificate.clinicalFindings ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink-body)]">
            {certificate.clinicalFindings}
          </p>
        ) : null}
        {certificate.restrictions ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ink-muted)]">
            Restrictions: {certificate.restrictions}
          </p>
        ) : null}
        {certificate.notes ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ink-muted)]">
            Notes: {certificate.notes}
          </p>
        ) : null}
        {certificate.status === 'ISSUED' ? (
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Issued {dateLabel(certificate.issuedAt)} · Valid until{' '}
            {dateLabel(certificate.expiresAt)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && certificate.status === 'DRAFT' ? (
          <Primary
            type="button"
            isDisabled={busy}
            onClick={() => onIssue(certificate)}
            text={busy ? 'Working…' : 'Issue certificate'}
          />
        ) : null}
        {certificate.status === 'ISSUED' ? (
          <Secondary
            type="button"
            icon={<IoPrintOutline aria-hidden="true" />}
            text="Print / save as PDF"
            onClick={() => onPrint(certificate)}
          />
        ) : null}
        {canEdit && certificate.status === 'ISSUED' ? (
          <Secondary
            type="button"
            isDisabled={busy}
            onClick={() => onRevoke(certificate)}
            text="Revoke"
          />
        ) : null}
      </div>
    </div>
  </li>
);

export type MedicalCertificatesPanelProps = {
  companionId: string;
  clientId: string;
  patientName: string;
};
const MedicalCertificatesPanel = ({
  companionId,
  clientId,
  patientName,
}: MedicalCertificatesPanelProps) => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.COMPANIONS_VIEW_ANY);
  const canEdit = permissions.can(PERMISSIONS.COMPANIONS_EDIT_ANY);
  const { notify } = useNotify();
  const [certificates, setCertificates] = useState<MedicalCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCertificates(await fetchMedicalCertificates(companionId));
    } catch {
      setError(LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [companionId]);
  useEffect(() => {
    if (!canView) return;
    const loadTimer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(loadTimer);
  }, [canView, load]);

  const handleAction = async (
    certificate: MedicalCertificate,
    action: typeof issueMedicalCertificate | typeof revokeMedicalCertificate,
    success: { title: string; text: string },
    errorTitle: string
  ) => {
    setActionId(certificate.id);
    try {
      const updated = await action(certificate.id, {});
      setCertificates((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      notify('success', success);
    } catch {
      notify('error', { title: errorTitle, text: 'Please try again.' });
    } finally {
      setActionId(null);
    }
  };
  const handlePrint = (certificate: MedicalCertificate) => {
    try {
      printCertificate(certificate, patientName);
    } catch {
      notify('error', {
        title: 'Could not open certificate',
        text: 'Allow pop-ups and try again.',
      });
    }
  };
  if (!canView) return null;

  return (
    <section className={cardClass} aria-labelledby="medical-certificates-heading">
      <header className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3">
        <span className="text-[var(--ink-muted)]" aria-hidden="true">
          <IoDocumentTextOutline size={17} />
        </span>
        <h2 id="medical-certificates-heading" className="text-[13.5px] font-bold text-[var(--ink)]">
          Medical certificates
        </h2>
      </header>
      <div className="space-y-4 px-4 py-3">
        {canEdit ? (
          <CertificateDraftForm
            companionId={companionId}
            clientId={clientId}
            onCreated={(created) => setCertificates((current) => [created, ...current])}
          />
        ) : null}
        {loading ? (
          <output className="text-sm text-[var(--ink-muted)]">Loading medical certificates…</output>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 text-sm text-[var(--danger-text)]"
          >
            <span>{error}</span>
            <Secondary type="button" text="Retry" onClick={load} />
          </div>
        ) : null}
        {!loading && !error && certificates.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No medical certificates yet.</p>
        ) : null}
        <ul className="space-y-3">
          {certificates.map((certificate) => (
            <CertificateCard
              key={certificate.id}
              certificate={certificate}
              canEdit={canEdit}
              busy={actionId === certificate.id}
              onIssue={(item) =>
                void handleAction(
                  item,
                  issueMedicalCertificate,
                  {
                    title: 'Certificate issued',
                    text: 'The certificate can now be printed or saved as PDF.',
                  },
                  'Could not issue certificate'
                )
              }
              onPrint={handlePrint}
              onRevoke={(item) => {
                if (globalThis.window.confirm('Revoke this medical certificate?')) {
                  void handleAction(
                    item,
                    revokeMedicalCertificate,
                    {
                      title: 'Certificate revoked',
                      text: 'The certificate is no longer valid.',
                    },
                    'Could not revoke certificate'
                  );
                }
              }}
            />
          ))}
        </ul>
      </div>
    </section>
  );
};

export default MedicalCertificatesPanel;
