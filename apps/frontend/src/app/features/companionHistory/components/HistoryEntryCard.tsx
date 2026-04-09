import React, { useMemo } from 'react';
import { HistoryEntry } from '@/app/features/companionHistory/types/history';
import { Badge, Card } from '@/app/ui';
import { RiExternalLinkLine } from 'react-icons/ri';
import {
  formatCurrency,
  formatHistoryDate,
  formatHistoryDateTime,
  getHistoryStatusBadgeTone,
  getHistoryTypeLabel,
  getHistoryTypeBadgeTone,
  getPayloadBoolean,
  getPayloadNumber,
  getPayloadString,
  getPrimaryActionLabel,
} from '@/app/features/companionHistory/utils/historyFormatters';
import { getPaymentCollectionMethodLabel } from '@/app/lib/invoicePaymentMethod';

type HistoryEntryCardProps = {
  entry: HistoryEntry;
  onOpen: (entry: HistoryEntry) => void;
};

type DetailPair = {
  label: string;
  value: string;
};

const ROLE_LABEL_MAP: Record<string, string> = {
  VET: 'Clinician',
  STAFF: 'Support staff',
  PARENT: 'Pet parent',
  SYSTEM: 'System',
};

const getPayloadStringArray = (payload: Record<string, unknown>, key: string): string[] => {
  const value = payload?.[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter((item) => item.length > 0);
};

const getAppointmentDetails = (entry: HistoryEntry): DetailPair[] => {
  const service = getPayloadString(entry.payload, ['serviceName']);
  const concern = getPayloadString(entry.payload, ['concern', 'reason']);
  const room = getPayloadString(entry.payload, ['room', 'roomName']);
  return [
    { label: 'Service', value: service || '-' },
    { label: 'Reason', value: concern || '-' },
    { label: 'Room', value: room || '-' },
  ];
};

const getTaskDetails = (entry: HistoryEntry): DetailPair[] => {
  const audience = getPayloadString(entry.payload, ['audience']);
  const dueAt = getPayloadString(entry.payload, ['dueAt']);
  const completedAt = getPayloadString(entry.payload, ['completedAt']);
  const medication = getPayloadString(entry.payload, ['medicationSummary', 'medication']);

  let statusDate = '-';
  if (completedAt) {
    statusDate = formatHistoryDate(completedAt);
  } else if (dueAt) {
    statusDate = formatHistoryDate(dueAt);
  }

  return [
    { label: 'Audience', value: audience || '-' },
    { label: completedAt ? 'Completed' : 'Due', value: statusDate },
    { label: 'Medication', value: medication || '-' },
  ];
};

const getFormDetails = (entry: HistoryEntry): DetailPair[] => {
  const category = getPayloadString(entry.payload, ['formCategory', 'category']);
  const signingPayload =
    entry.payload && typeof entry.payload.signing === 'object' && entry.payload.signing !== null
      ? (entry.payload.signing as Record<string, unknown>)
      : null;
  const nestedSigningStatus =
    signingPayload && typeof signingPayload.status === 'string' ? signingPayload.status : null;
  const signedStatus = nestedSigningStatus || getPayloadString(entry.payload, ['signingStatus']);
  const submittedAt = getPayloadString(entry.payload, ['submittedAt']);
  const soapSubtype = getPayloadString(entry.payload, ['soapSubtype']);
  const signatureLabel = formatStatusLabel(signedStatus || entry.status) || '-';

  return [
    { label: 'Category', value: category || '-' },
    { label: 'SOAP type', value: soapSubtype || '-' },
    { label: 'Submitted', value: submittedAt ? formatHistoryDate(submittedAt) : '-' },
    { label: 'Signature', value: signatureLabel },
  ];
};

const getDocumentSourceLabel = (entry: HistoryEntry): string => {
  const synced = getPayloadBoolean(entry.payload, ['syncedFromPms']);
  if (synced === null) {
    return entry.source;
  }
  return synced ? 'Synced' : 'Manual';
};

const getDocumentDetails = (entry: HistoryEntry): DetailPair[] => {
  const category = getPayloadString(entry.payload, ['category']);
  const subcategory = getPayloadString(entry.payload, ['subcategory']);
  const issueDate = getPayloadString(entry.payload, ['issueDate']);
  const issuer = getPayloadString(entry.payload, ['issuingBusinessName']);
  const sourceLabel = getDocumentSourceLabel(entry);

  return [
    { label: 'Category', value: category || '-' },
    { label: 'Sub-category', value: subcategory || '-' },
    { label: 'Issue date', value: issueDate ? formatHistoryDate(issueDate) : '-' },
    { label: 'Issuer', value: issuer || '-' },
    { label: 'Source', value: sourceLabel },
  ];
};

const getLabDetails = (entry: HistoryEntry): DetailPair[] => {
  const provider = getPayloadString(entry.payload, ['provider']) || 'IDEXX';
  const accession = getPayloadString(entry.payload, ['accessionId', 'orderId']);
  const resultStatus = getPayloadString(entry.payload, ['status']);
  const abnormalityPreview = getPayloadString(entry.payload, ['abnormalityPreview']);

  return [
    { label: 'Provider', value: provider },
    { label: 'Result status', value: resultStatus || entry.status || '-' },
    { label: 'Accession', value: accession || '-' },
    { label: 'Preview', value: abnormalityPreview || '-' },
  ];
};

const getInvoiceDetails = (entry: HistoryEntry): DetailPair[] => {
  const totalAmount = getPayloadNumber(entry.payload, ['totalAmount']);
  const currency = getPayloadString(entry.payload, ['currency']);
  const collectionMethod = getPaymentCollectionMethodLabel(
    getPayloadString(entry.payload, ['paymentCollectionMethod'])
  );
  const paidAt = getPayloadString(entry.payload, ['paidAt']);
  const status =
    formatStatusLabel(getPayloadString(entry.payload, ['status']) || entry.status) || '-';

  return [
    { label: 'Status', value: status },
    { label: 'Amount', value: formatCurrency(totalAmount, currency) || '-' },
    { label: 'Payment method', value: collectionMethod || '-' },
    { label: 'Paid date', value: paidAt ? formatHistoryDate(paidAt) : '-' },
  ];
};

const getDetails = (entry: HistoryEntry): DetailPair[] => {
  if (entry.type === 'APPOINTMENT') return getAppointmentDetails(entry);
  if (entry.type === 'TASK') return getTaskDetails(entry);
  if (entry.type === 'FORM_SUBMISSION') return getFormDetails(entry);
  if (entry.type === 'DOCUMENT') return getDocumentDetails(entry);
  if (entry.type === 'LAB_RESULT') return getLabDetails(entry);
  return getInvoiceDetails(entry);
};

const formatStatusLabel = (status?: string): string => {
  const normalized = String(status ?? '').trim();
  if (!normalized) return '';
  return normalized
    .toLowerCase()
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
};

const normalizeText = (value: string): string =>
  value.toLowerCase().replaceAll(',', '').replaceAll(/\s+/g, ' ').trim();

const getDedupedSubtitle = (entry: HistoryEntry): string => {
  const subtitle = String(entry.subtitle ?? '').trim();
  if (!subtitle) return '';

  const occurredDateLabel = formatHistoryDate(entry.occurredAt);
  const normalizedSubtitle = normalizeText(subtitle);
  const normalizedOccurredDate = normalizeText(occurredDateLabel);
  if (normalizedSubtitle === normalizedOccurredDate) return '';

  const escapedOccurredDate = occurredDateLabel.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const datePrefixPattern = new RegExp(String.raw`^${escapedOccurredDate}\s*[•|-]\s*`, 'gi');
  const withoutDatePrefix = subtitle.replaceAll(datePrefixPattern, '').trim();

  if (withoutDatePrefix && normalizeText(withoutDatePrefix) !== normalizedOccurredDate) {
    return withoutDatePrefix;
  }

  return subtitle;
};

const getContributorDetails = (entry: HistoryEntry): DetailPair[] => {
  const leadName =
    getPayloadString(entry.payload, ['leadName', 'leadVet', 'leadVetName']) ||
    entry.actor?.name?.trim() ||
    '';
  const supportNames = getPayloadStringArray(entry.payload, 'supportStaffNames');
  const supportSingle = getPayloadString(entry.payload, ['supportStaffName']);
  const supportDisplay = [...supportNames, supportSingle].filter(Boolean).join(', ');
  const actorName = entry.actor?.name?.trim() || '';
  const actorRoleKey = String(entry.actor?.role ?? '')
    .trim()
    .toUpperCase();
  const actorRoleLabel = ROLE_LABEL_MAP[actorRoleKey] || '';

  if (leadName || supportDisplay) {
    return [
      { label: 'Lead', value: leadName || '-' },
      { label: 'Support', value: supportDisplay || '-' },
    ].filter((detail) => detail.value !== '-');
  }

  if (actorName && actorRoleLabel) {
    return [{ label: 'Updated by', value: `${actorName} • ${actorRoleLabel}` }];
  }
  if (actorName) {
    return [{ label: 'Updated by', value: actorName }];
  }
  if (actorRoleLabel) {
    return [{ label: 'Updated by', value: actorRoleLabel }];
  }
  return [];
};

const HistoryEntryCard = ({ entry, onOpen }: HistoryEntryCardProps) => {
  const actionLabel = useMemo(() => getPrimaryActionLabel(entry), [entry]);
  const statusLabel = useMemo(() => formatStatusLabel(entry.status), [entry.status]);
  const details = useMemo(() => {
    return getDetails(entry)
      .filter((item) => item.value && item.value !== '-')
      .slice(0, 3);
  }, [entry]);

  const contributorDetails = useMemo(() => getContributorDetails(entry), [entry]);
  const subtitle = useMemo(() => getDedupedSubtitle(entry), [entry]);
  const serviceReasonDetails = useMemo(
    () =>
      entry.type === 'APPOINTMENT'
        ? details.filter((detail) => detail.label === 'Service' || detail.label === 'Reason')
        : [],
    [details, entry.type]
  );
  const detailsForGrid = useMemo(
    () =>
      entry.type === 'APPOINTMENT'
        ? details.filter((detail) => detail.label !== 'Service' && detail.label !== 'Reason')
        : details,
    [details, entry.type]
  );

  return (
    <Card variant="default" className="w-full font-satoshi px-3 py-2.5 md:px-3.5 md:py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={getHistoryTypeBadgeTone(entry.type)} className="px-2 py-0.5 text-caption-1">
            {getHistoryTypeLabel(entry.type)}
          </Badge>
        </div>
        {statusLabel ? (
          <Badge
            tone={getHistoryStatusBadgeTone(entry.status)}
            className="px-2 py-0.5 text-caption-1"
          >
            {statusLabel}
          </Badge>
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-col gap-0.5">
        <button
          type="button"
          aria-label={actionLabel}
          onClick={() => onOpen(entry)}
          className="group inline-flex w-fit items-center gap-1 text-left"
        >
          <span className="text-body-4-emphasis leading-snug text-text-primary transition-colors group-hover:text-text-brand group-hover:underline">
            {entry.title}
          </span>
          <span className="inline-flex items-center justify-center rounded-r-2xl pl-1 pr-0.5 text-text-secondary transition-colors group-hover:text-text-brand">
            <RiExternalLinkLine size={12} />
          </span>
        </button>
        {subtitle ? <div className="text-caption-1 text-text-secondary">{subtitle}</div> : null}
        {entry.summary && entry.type !== 'APPOINTMENT' ? (
          <div className="text-caption-1 leading-snug text-text-primary">{entry.summary}</div>
        ) : null}
      </div>

      {serviceReasonDetails.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {serviceReasonDetails.map((detail, index) => (
            <div key={`${entry.id}-${detail.label}`} className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="text-caption-1 text-text-extra">{detail.label}:</span>
                <span className="text-caption-1 text-text-primary">{detail.value}</span>
              </span>
              {index < serviceReasonDetails.length - 1 ? (
                <span className="text-caption-1 text-text-extra">•</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {detailsForGrid.length > 0 ? (
        <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
          {detailsForGrid.map((detail) => (
            <div key={`${entry.id}-${detail.label}`} className="flex min-w-0 items-start gap-1.5">
              <div className="shrink-0 text-caption-1 text-text-extra">{detail.label}:</div>
              <div className="truncate text-caption-1 text-text-primary">{detail.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          {contributorDetails.map((detail, index) => (
            <div key={`${entry.id}-${detail.label}`} className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="text-caption-1 text-text-extra">{detail.label}:</span>
                <span className="text-caption-1 text-text-primary">{detail.value}</span>
              </span>
              {index < contributorDetails.length - 1 ? (
                <span className="text-caption-1 text-text-extra">•</span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="shrink-0 text-caption-1 text-right text-text-secondary">
          {formatHistoryDateTime(entry.occurredAt)}
        </div>
      </div>

      {(entry.tags ?? []).length > 0 ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {(entry.tags ?? []).map((tag) => (
            <span
              key={`${entry.id}-${tag}`}
              className="rounded-full bg-card-hover px-2 py-0.5 text-caption-1 text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  );
};

export default HistoryEntryCard;
