import React, { useMemo } from 'react';
import { HistoryEntry } from '@/app/features/companionHistory/types/history';
import { Card } from '@/app/ui';
import { RiExternalLinkLine } from 'react-icons/ri';
import {
  formatCurrency,
  formatHistoryDate,
  formatHistoryDateTime,
  getHistoryTypeLabel,
  getPayloadBoolean,
  getPayloadNumber,
  getPayloadString,
  getPrimaryActionLabel,
  getTypeBadgeClassName,
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

const getAppointmentDetails = (entry: HistoryEntry): DetailPair[] => {
  const service = getPayloadString(entry.payload, ['serviceName']);
  const concern = getPayloadString(entry.payload, ['concern', 'reason']);
  const leadVet = getPayloadString(entry.payload, ['leadVet', 'leadVetName']);
  const room = getPayloadString(entry.payload, ['room', 'roomName']);
  return [
    { label: 'Service', value: service || '-' },
    { label: 'Reason', value: concern || '-' },
    { label: 'Lead vet', value: leadVet || '-' },
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
  const signedStatus = getPayloadString(entry.payload, ['signingStatus']);
  const submittedAt = getPayloadString(entry.payload, ['submittedAt']);
  const soapSubtype = getPayloadString(entry.payload, ['soapSubtype']);

  return [
    { label: 'Category', value: category || '-' },
    { label: 'SOAP type', value: soapSubtype || '-' },
    { label: 'Submitted', value: submittedAt ? formatHistoryDate(submittedAt) : '-' },
    { label: 'Signature', value: signedStatus || (entry.status ?? '-') },
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

const HistoryEntryCard = ({ entry, onOpen }: HistoryEntryCardProps) => {
  const actionLabel = useMemo(() => getPrimaryActionLabel(entry), [entry]);
  const statusLabel = useMemo(() => formatStatusLabel(entry.status), [entry.status]);
  const details = useMemo(() => {
    return getDetails(entry)
      .filter((item) => item.value && item.value !== '-')
      .slice(0, 3);
  }, [entry]);

  const actorDisplay = useMemo(() => {
    const actorName = entry.actor?.name?.trim();
    const actorRole = entry.actor?.role?.trim();

    if (actorName && actorRole) return `${actorName} • ${actorRole}`;
    if (actorName) return actorName;
    if (actorRole) return actorRole;
    return null;
  }, [entry.actor?.name, entry.actor?.role]);

  return (
    <Card variant="default" className="w-full px-3 py-2.5 md:px-3.5 md:py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-label-xsmall ${getTypeBadgeClassName(entry.type)}`}
          >
            {getHistoryTypeLabel(entry.type)}
          </span>
          {statusLabel ? (
            <span className="rounded-full bg-card-hover px-2 py-0.5 text-label-xsmall text-text-secondary">
              {statusLabel}
            </span>
          ) : null}
        </div>
        <div className="text-caption-2 text-text-secondary">
          {formatHistoryDateTime(entry.occurredAt)}
        </div>
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
        {entry.subtitle ? (
          <div className="text-caption-2 text-text-secondary">{entry.subtitle}</div>
        ) : null}
        {entry.summary ? (
          <div className="text-caption-2 leading-snug text-text-primary">{entry.summary}</div>
        ) : null}
      </div>

      {actorDisplay ? (
        <div className="mt-2 text-caption-2 text-text-secondary">Actor: {actorDisplay}</div>
      ) : null}

      {details.length > 0 ? (
        <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={`${entry.id}-${detail.label}`} className="flex min-w-0 items-start gap-1.5">
              <div className="shrink-0 text-caption-2 text-text-extra">{detail.label}:</div>
              <div className="truncate text-caption-2 text-text-primary">{detail.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-card-border pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(entry.tags ?? []).map((tag) => (
            <span
              key={`${entry.id}-${tag}`}
              className="rounded-full bg-card-hover px-2 py-0.5 text-label-xsmall text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default HistoryEntryCard;
