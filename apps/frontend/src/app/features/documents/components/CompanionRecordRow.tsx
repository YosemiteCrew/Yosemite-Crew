import React from 'react';
import { IoChevronForwardOutline } from 'react-icons/io5';
import {
  CompanionRecord,
  getCompanionDocumentSubcategoryLabel,
} from '@/app/features/documents/types/companionDocuments';
import { formatDateLabel } from '@/app/lib/forms';
import StatusPill, { type StatusPillTokens } from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  RecordStatusTone,
  getAttachmentSummary,
  getDocumentSource,
  getRecordIcon,
  getRecordStatusPills,
} from '@/app/features/documents/components/recordDisplay';

type CompanionRecordRowProps = {
  doc: CompanionRecord;
  onOpen: () => void;
};

const STATUS_PILL_TOKENS: Record<RecordStatusTone, StatusPillTokens> = {
  success: {
    bg: 'var(--status-completed-bg)',
    text: 'var(--status-completed-text)',
    border: 'var(--status-completed-border)',
  },
  warning: { bg: 'var(--warn-bg)', text: 'var(--warn-text)', border: 'var(--warn-border)' },
  info: {
    bg: 'var(--status-upcoming-bg)',
    text: 'var(--status-upcoming-text)',
    border: 'var(--status-upcoming-border)',
  },
};

/**
 * One record in the companion medical record list, per the "Records & Reference"
 * design: a typed 38px icon tile, a title with a date/source sub-line and a
 * type/attachment meta line, trailing status pills, and a chevron. The whole row
 * is a button that opens the underlying file.
 */
const CompanionRecordRow = ({ doc, onOpen }: CompanionRecordRowProps) => {
  const title = doc.title || 'Untitled document';
  const Icon = getRecordIcon(doc);
  const source = getDocumentSource(doc);
  const subcategoryLabel = getCompanionDocumentSubcategoryLabel(doc.subcategory);
  const attachmentSummary = getAttachmentSummary(doc);
  const dateLabel = doc.issueDate ? formatDateLabel(doc.issueDate) : 'Undated';
  const pills = getRecordStatusPills(doc);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${title}`}
      className="flex w-full items-center gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--screen)] px-4 py-3 text-left shadow-[0_1px_2px_var(--sh03)] transition-colors hover:border-[var(--hairline-hover)]"
    >
      <span
        aria-hidden="true"
        className="grid size-[38px] flex-none place-items-center rounded-xl bg-[var(--blue-soft)] text-[var(--blue-text)]"
      >
        <Icon size={17} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13.5px] font-bold text-[var(--ink)]">{title}</span>
        <span className="truncate text-[11.5px] text-[var(--ink-faint)]">
          {dateLabel} · {source}
        </span>
        <span className="truncate text-[11px] text-[var(--ink-faint)]">
          {subcategoryLabel} · {attachmentSummary}
        </span>
      </span>
      <span className="flex flex-none flex-wrap items-center justify-end gap-1.5">
        {pills.map((pill) => (
          <StatusPill key={pill.label} label={pill.label} tokens={STATUS_PILL_TOKENS[pill.tone]} />
        ))}
      </span>
      <IoChevronForwardOutline
        size={15}
        className="flex-none text-[var(--ink-faint)]"
        aria-hidden="true"
      />
    </button>
  );
};

export default CompanionRecordRow;
