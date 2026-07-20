import React, { useMemo } from 'react';
import {
  IoChevronForwardOutline,
  IoClipboardOutline,
  IoDocumentTextOutline,
  IoFlaskOutline,
  IoMedkitOutline,
  IoReceiptOutline,
} from 'react-icons/io5';
import { HistoryEntry, HistoryEntryType } from '@/app/features/companionHistory/types/history';
import { Badge } from '@/app/ui';
import { getStatusStyle } from '@/app/config/statusConfig';
import {
  formatHistoryDate,
  formatHistoryDateTime,
  getHistoryStatusBadgeTone,
  getPayloadString,
  getPrimaryActionLabel,
} from '@/app/features/companionHistory/utils/historyFormatters';

type HistoryEntryCardProps = {
  entry: HistoryEntry;
  onOpen: (entry: HistoryEntry) => void;
  /** Hides the connector line for the final entry in the timeline. */
  isLast?: boolean;
  /** Interactive status control (editable pill for appointments/tasks). Falls back to a read-only badge. */
  statusSlot?: React.ReactNode;
  /** Inline action chips (PDF preview, accept/reject, expand toggle). */
  actions?: React.ReactNode;
  /** Expanded detail region (e.g. structured lab results). */
  expandedContent?: React.ReactNode;
  /** When provided, renders a trailing chevron that opens the record detail drawer. */
  onOpenDetail?: (entry: HistoryEntry) => void;
  /** Marks the row as the record currently open in the detail drawer. */
  active?: boolean;
};

type AttachmentChip = {
  key: string;
  icon: React.ReactNode;
  label: string;
};

const ROLE_LABEL_MAP: Record<string, string> = {
  VET: 'Clinician',
  STAFF: 'Support staff',
  PARENT: 'Pet parent',
  SYSTEM: 'System',
};

// Per-type spine icon. Appointments/vaccines reuse the medical kit glyph, records
// use the document glyph, diagnostics the flask, billing the receipt.
const TYPE_ICON_SIZE = 15;

const getTypeIcon = (type: HistoryEntryType): React.ReactNode => {
  if (type === 'LAB_RESULT') return <IoFlaskOutline size={TYPE_ICON_SIZE} aria-hidden="true" />;
  if (type === 'INVOICE') return <IoReceiptOutline size={TYPE_ICON_SIZE} aria-hidden="true" />;
  if (type === 'TASK') return <IoClipboardOutline size={TYPE_ICON_SIZE} aria-hidden="true" />;
  if (type === 'DOCUMENT' || type === 'FORM_SUBMISSION') {
    return <IoDocumentTextOutline size={TYPE_ICON_SIZE} aria-hidden="true" />;
  }
  return <IoMedkitOutline size={TYPE_ICON_SIZE} aria-hidden="true" />;
};

// The record open in the detail drawer takes the design's selected-row chrome:
// the soft surface plus a blue hairline and a 3px blue focus ring.
const ACTIVE_ROW_STYLE: React.CSSProperties = {
  background: 'var(--surface-soft)',
  borderColor: 'var(--blue)',
  boxShadow: '0 0 0 3px rgba(37,123,237,0.10)',
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

// The meta line reads "<date · time> · <who>", threading the contributor (lead vet
// or acting user) after the timestamp exactly as the design mock shows.
const getContributor = (entry: HistoryEntry): string => {
  const lead = getPayloadString(entry.payload, [
    'leadName',
    'leadVetName',
    'leadVet',
    'createdByName',
    'submittedByName',
  ]);
  if (lead) return lead;
  const actorName = entry.actor?.name?.trim();
  if (actorName) return actorName;
  const roleKey = String(entry.actor?.role ?? '')
    .trim()
    .toUpperCase();
  return ROLE_LABEL_MAP[roleKey] ?? '';
};

const getMetaText = (entry: HistoryEntry): string => {
  const timestamp = formatHistoryDateTime(entry.occurredAt);
  const contributor = getContributor(entry);
  return contributor ? `${timestamp} · ${contributor}` : timestamp;
};

const getAttachmentLabel = (attachment: unknown): string => {
  if (typeof attachment === 'string') return attachment.trim();
  const name = (attachment as { name?: unknown })?.name;
  return typeof name === 'string' || typeof name === 'number' ? String(name).trim() : '';
};

const getAttachmentChips = (entry: HistoryEntry): AttachmentChip[] => {
  const chips: AttachmentChip[] = [];
  const fileName = getPayloadString(entry.payload, [
    'fileName',
    'documentName',
    'attachmentName',
    'certificateName',
  ]);
  if (fileName) {
    chips.push({
      key: 'file',
      icon: <IoDocumentTextOutline size={10} aria-hidden="true" />,
      label: fileName,
    });
  }

  const attachments = Array.isArray(entry.payload.attachments) ? entry.payload.attachments : [];
  attachments.forEach((attachment, index) => {
    const label = getAttachmentLabel(attachment);
    if (label) {
      chips.push({
        key: `attachment-${index}`,
        icon: <IoDocumentTextOutline size={10} aria-hidden="true" />,
        label,
      });
    }
  });

  const invoiceNumber = getPayloadString(entry.payload, ['invoiceNumber', 'invoiceRef']);
  if (invoiceNumber) {
    chips.push({
      key: 'invoice',
      icon: <IoReceiptOutline size={10} aria-hidden="true" />,
      label: `Invoice #${invoiceNumber}`,
    });
  }

  return chips;
};

const getBadgeTint = (entry: HistoryEntry): React.CSSProperties => {
  const statusKey = String(entry.status ?? '')
    .trim()
    .toLowerCase();
  if (statusKey) {
    const style = getStatusStyle(statusKey);
    return {
      background: style.backgroundColor,
      borderColor: style.borderColor,
      color: style.color,
    };
  }
  // Statusless informational entries (documents, signed forms) use the blue accent.
  return {
    background: 'var(--blue-soft)',
    borderColor: 'var(--status-upcoming-border)',
    color: 'var(--blue-text)',
  };
};

const HistoryEntryCard = ({
  entry,
  onOpen,
  isLast = false,
  statusSlot,
  actions,
  expandedContent,
  onOpenDetail,
  active = false,
}: HistoryEntryCardProps) => {
  const actionLabel = useMemo(() => getPrimaryActionLabel(entry), [entry]);
  const statusLabel = useMemo(() => formatStatusLabel(entry.status), [entry.status]);
  const meta = useMemo(() => getMetaText(entry), [entry]);
  const subtitle = useMemo(() => getDedupedSubtitle(entry), [entry]);
  const attachmentChips = useMemo(() => getAttachmentChips(entry), [entry]);
  const tint = useMemo(() => getBadgeTint(entry), [entry]);
  const tags = entry.tags ?? [];

  return (
    <li
      className={`flex gap-[11px] font-satoshi md:gap-[14px] ${
        active ? 'rounded-[14px] border px-2 py-1.5' : ''
      }`}
      style={active ? ACTIVE_ROW_STYLE : undefined}
    >
      <span className="flex flex-none flex-col items-center">
        <span
          aria-hidden="true"
          className="flex size-[30px] items-center justify-center rounded-full border md:size-[34px]"
          style={tint}
        >
          {getTypeIcon(entry.type)}
        </span>
        {isLast ? null : (
          <span
            aria-hidden="true"
            className="my-[3px] flex-1 md:my-1"
            style={{ width: '1.5px', background: 'var(--hairline)' }}
          />
        )}
      </span>

      <div className={isLast ? 'min-w-0 flex-1' : 'min-w-0 flex-1 pb-3 md:pb-4'}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={actionLabel}
            onClick={() => onOpen(entry)}
            className="group inline-flex w-fit max-w-full items-center text-left"
          >
            <span className="truncate text-[13px] font-bold leading-snug text-[var(--ink)] transition-colors group-hover:text-[var(--blue-text)] group-hover:underline md:text-[14px]">
              {entry.title}
            </span>
          </button>
          {statusSlot ??
            (statusLabel ? (
              <Badge tone={getHistoryStatusBadgeTone(entry.status)}>{statusLabel}</Badge>
            ) : null)}
          {meta ? (
            <span className="text-[11px] text-[var(--ink-faint)] md:text-[12px]">{meta}</span>
          ) : null}
        </div>

        {subtitle ? (
          <span className="mt-[1px] block text-[11px] text-[var(--ink-faint)] md:mt-[3px] md:text-[12.5px] md:text-[color:var(--ink-muted)]">
            {subtitle}
          </span>
        ) : null}
        {entry.summary ? (
          <span className="mt-[1px] block text-[11px] text-[var(--ink-faint)] md:mt-[3px] md:text-[12.5px] md:text-[color:var(--ink-muted)]">
            {entry.summary}
          </span>
        ) : null}

        {attachmentChips.length > 0 || actions ? (
          <span className="mt-[6px] flex flex-wrap items-center gap-[5px] md:mt-2 md:gap-1.5">
            {attachmentChips.map((chip) => (
              <span
                key={`${entry.id}-${chip.key}`}
                className="inline-flex items-center gap-1 rounded-[9px] px-2.5 py-[5px] text-[10.5px] font-semibold text-[var(--ink-body)] md:py-1 md:text-[11px]"
                style={{ background: 'var(--inset)' }}
              >
                <span aria-hidden="true" className="inline-flex text-[var(--blue-text)]">
                  {chip.icon}
                </span>
                {chip.label}
              </span>
            ))}
            {actions}
          </span>
        ) : null}

        {expandedContent}

        {tags.length > 0 ? (
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span
                key={`${entry.id}-${tag}`}
                className="rounded-full bg-[var(--inset)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]"
              >
                {tag}
              </span>
            ))}
          </span>
        ) : null}
      </div>

      {onOpenDetail ? (
        <button
          type="button"
          aria-label={`Open record detail for ${entry.title}`}
          onClick={() => onOpenDetail(entry)}
          className="flex size-7 flex-none items-center justify-center self-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          <IoChevronForwardOutline size={15} aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
};

export default HistoryEntryCard;
