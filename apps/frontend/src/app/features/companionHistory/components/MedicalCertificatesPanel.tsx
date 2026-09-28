'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

const typeLabel = (type: MedicalCertificateType): string =>
  CERTIFICATE_TYPES.find((item) => item.value === type)?.label ?? 'Medical certificate';

const dateLabel = (date: string | null): string =>
  date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(date)) : '—';

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
  const content = rows
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<section><h2>${escapeHtml(label)}</h2><p>${escapeHtml(value)}</p></section>`
    )
    .join('');
  popup.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(typeLabel(certificate.certificateType))}</title><style>body{font:16px system-ui,sans-serif;color:#17232a;margin:48px auto;max-width:720px;padding:0 24px}h1{font-size:28px}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#52636b}section{border-bottom:1px solid #d8e0e3;padding:10px 0;white-space:pre-wrap}@media print{body{margin:18mm auto}}</style></head><body><h1>${escapeHtml(typeLabel(certificate.certificateType))}</h1>${content}<script>window.addEventListener('load',()=>window.print())</script></body></html>`
  );
  popup.document.close();
};

export type MedicalCertificatesPanelProps = {
  companionId: string;
  clientId: string;
  patientName: string;
};

const LOAD_ERROR = 'Could not load medical certificates. Please try again.';

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
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [certificateType, setCertificateType] =
    useState<MedicalCertificateType>('HEALTH_CERTIFICATE');
  const [findings, setFindings] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [notes, setNotes] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [validForTravel, setValidForTravel] = useState(false);

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
    let active = true;
    fetchMedicalCertificates(companionId)
      .then((items) => {
        if (active) setCertificates(items);
      })
      .catch(() => {
        if (active) setError(LOAD_ERROR);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, companionId]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: CreateMedicalCertificateInput = {
      patientId: companionId,
      clientId,
      certificateType,
      validForTravel,
      ...(destinationCountry.trim() ? { destinationCountry: destinationCountry.trim() } : {}),
      ...(findings.trim() ? { clinicalFindings: findings.trim() } : {}),
      ...(restrictions.trim() ? { restrictions: restrictions.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    setSaving(true);
    try {
      const created = await createMedicalCertificate(input);
      setCertificates((current) => [created, ...current]);
      setFindings('');
      setRestrictions('');
      setNotes('');
      setDestinationCountry('');
      setValidForTravel(false);
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

  const handleIssue = async (certificate: MedicalCertificate) => {
    setActionId(certificate.id);
    try {
      const issued = await issueMedicalCertificate(certificate.id, {});
      setCertificates((current) => current.map((item) => (item.id === issued.id ? issued : item)));
      notify('success', {
        title: 'Certificate issued',
        text: 'The certificate can now be printed or saved as PDF.',
      });
    } catch {
      notify('error', { title: 'Could not issue certificate', text: 'Please try again.' });
    } finally {
      setActionId(null);
    }
  };

  const handleRevoke = async (certificate: MedicalCertificate) => {
    if (!globalThis.window.confirm('Revoke this medical certificate?')) return;
    setActionId(certificate.id);
    try {
      const revoked = await revokeMedicalCertificate(certificate.id, {});
      setCertificates((current) =>
        current.map((item) => (item.id === revoked.id ? revoked : item))
      );
      notify('success', {
        title: 'Certificate revoked',
        text: 'The certificate is no longer valid.',
      });
    } catch {
      notify('error', { title: 'Could not revoke certificate', text: 'Please try again.' });
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
          <form
            className="grid gap-3 rounded-xl border border-[var(--divider)] p-3 sm:grid-cols-2"
            onSubmit={handleCreate}
          >
            <label className="grid gap-1 text-sm font-medium text-[var(--ink)]">
              Certificate type
              <select
                name="certificateType"
                className="rounded-lg border border-[var(--divider)] bg-card px-3 py-2"
                value={certificateType}
                onChange={(event) =>
                  setCertificateType(event.target.value as MedicalCertificateType)
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
                checked={validForTravel}
                onChange={(event) => setValidForTravel(event.target.checked)}
              />
              Valid for travel
            </label>
            {validForTravel ? (
              <label className="grid gap-1 text-sm font-medium text-[var(--ink)] sm:col-span-2">
                Destination country
                <input
                  name="destinationCountry"
                  className="rounded-lg border border-[var(--divider)] bg-card px-3 py-2"
                  value={destinationCountry}
                  onChange={(event) => setDestinationCountry(event.target.value)}
                  maxLength={100}
                />
              </label>
            ) : null}
            <label className="grid gap-1 text-sm font-medium text-[var(--ink)] sm:col-span-2">
              Clinical findings
              <Textarea
                name="clinicalFindings"
                className="min-h-20 rounded-lg border border-[var(--divider)] bg-card px-3 py-2"
                value={findings}
                onChange={(event) => setFindings(event.target.value)}
                maxLength={4000}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-[var(--ink)] sm:col-span-2">
              Restrictions
              <Textarea
                name="restrictions"
                className="min-h-16 rounded-lg border border-[var(--divider)] bg-card px-3 py-2"
                value={restrictions}
                onChange={(event) => setRestrictions(event.target.value)}
                maxLength={2000}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-[var(--ink)] sm:col-span-2">
              Notes
              <Textarea
                name="notes"
                className="min-h-16 rounded-lg border border-[var(--divider)] bg-card px-3 py-2"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={2000}
              />
            </label>
            <div className="sm:col-span-2">
              <Primary type="submit" isDisabled={saving} text={saving ? 'Saving…' : 'Save draft'} />
            </div>
          </form>
        ) : null}

        {loading ? (
          <p role="status" className="text-sm text-[var(--ink-muted)]">
            Loading medical certificates…
          </p>
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
            <li key={certificate.id} className="rounded-xl border border-[var(--divider)] p-3">
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
                      isDisabled={actionId === certificate.id}
                      onClick={() => void handleIssue(certificate)}
                      text={actionId === certificate.id ? 'Working…' : 'Issue certificate'}
                    />
                  ) : null}
                  {certificate.status === 'ISSUED' ? (
                    <Secondary
                      type="button"
                      icon={<IoPrintOutline aria-hidden="true" />}
                      text="Print / save as PDF"
                      onClick={() => handlePrint(certificate)}
                    />
                  ) : null}
                  {canEdit && certificate.status === 'ISSUED' ? (
                    <Secondary
                      type="button"
                      isDisabled={actionId === certificate.id}
                      onClick={() => void handleRevoke(certificate)}
                      text="Revoke"
                    />
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default MedicalCertificatesPanel;
