import React, { useMemo } from 'react';
import { HistoryEntry } from '@/app/features/companionHistory/types/history';
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

  const statusDate = completedAt
    ? formatHistoryDate(completedAt)
    : dueAt
      ? formatHistoryDate(dueAt)
      : '-';

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

const getDocumentDetails = (entry: HistoryEntry): DetailPair[] => {
  const category = getPayloadString(entry.payload, ['category']);
  const subcategory = getPayloadString(entry.payload, ['subcategory']);
  const issueDate = getPayloadString(entry.payload, ['issueDate']);
  const issuer = getPayloadString(entry.payload, ['issuingBusinessName']);
  const synced = getPayloadBoolean(entry.payload, ['syncedFromPms']);

  return [
    { label: 'Category', value: category || '-' },
    { label: 'Sub-category', value: subcategory || '-' },
    { label: 'Issue date', value: issueDate ? formatHistoryDate(issueDate) : '-' },
    { label: 'Issuer', value: issuer || '-' },
    { label: 'Source', value: synced === null ? entry.source : synced ? 'Synced' : 'Manual' },
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
  const collectionMethod = getPayloadString(entry.payload, ['paymentCollectionMethod']);
  const paidAt = getPayloadString(entry.payload, ['paidAt']);
  const status = getPayloadString(entry.payload, ['status']) || entry.status || '-';

  return [
    { label: 'Status', value: status },
    { label: 'Amount', value: formatCurrency(totalAmount, currency) || '-' },
    { label: 'Collection', value: collectionMethod || '-' },
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

const HistoryEntryCard = ({ entry, onOpen }: HistoryEntryCardProps) => {
  const details = useMemo(
    () => getDetails(entry).filter((item) => item.value && item.value !== '-'),
    [entry]
  );

  return (
    <div className="w-full rounded-2xl border border-card-border bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-label-xsmall ${getTypeBadgeClassName(entry.type)}`}
          >
            {getHistoryTypeLabel(entry.type)}
          </span>
          {entry.status ? (
            <span className="rounded-full bg-card-hover px-2 py-1 text-label-xsmall text-text-secondary">
              {entry.status}
            </span>
          ) : null}
        </div>
        <div className="text-caption-1 text-text-secondary">
          {formatHistoryDateTime(entry.occurredAt)}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <div className="text-body-3-emphasis text-text-primary">{entry.title}</div>
        {entry.subtitle ? (
          <div className="text-caption-1 text-text-secondary">{entry.subtitle}</div>
        ) : null}
        {entry.summary ? (
          <div className="text-caption-1 text-text-primary">{entry.summary}</div>
        ) : null}
      </div>

      {entry.actor?.name ? (
        <div className="mt-2 text-caption-1 text-text-secondary">Actor: {entry.actor.name}</div>
      ) : null}

      {details.length > 0 ? (
        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={`${entry.id}-${detail.label}`} className="flex items-center gap-1.5">
              <div className="text-caption-1 text-text-extra">{detail.label}:</div>
              <div className="text-caption-1 text-text-primary">{detail.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-card-border pt-3">
        <div className="flex flex-wrap items-center gap-1">
          {(entry.tags ?? []).map((tag) => (
            <span
              key={`${entry.id}-${tag}`}
              className="rounded-full bg-card-hover px-2 py-1 text-label-xsmall text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onOpen(entry)}
          className="rounded-2xl border border-text-primary px-4 py-2 text-caption-1 text-text-primary transition-colors hover:border-text-brand hover:text-text-brand"
        >
          {getPrimaryActionLabel(entry)}
        </button>
      </div>
    </div>
  );
};

export default HistoryEntryCard;
