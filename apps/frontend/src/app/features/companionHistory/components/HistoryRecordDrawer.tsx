import React from 'react';
import {
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoChevronForwardOutline,
  IoClose,
  IoDownloadOutline,
  IoShareOutline,
} from 'react-icons/io5';
import { HistoryEntry } from '@/app/features/companionHistory/types/history';
import { formatHistoryDateTime } from '@/app/features/companionHistory/utils/historyFormatters';

export type RecordDetailPair = {
  label: string;
  value: string;
};

type HistoryRecordDrawerProps = {
  entry: HistoryEntry | null;
  results: RecordDetailPair[];
  linkedLabel: string | null;
  onClose: () => void;
  onDownload: (entry: HistoryEntry) => void;
  onOpenLinked: (entry: HistoryEntry) => void;
  onShare: (entry: HistoryEntry) => void;
  onDiscuss: (entry: HistoryEntry) => void;
};

const MICRO_CAPTION_CLASS =
  'text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]';

const FOOTER_SECONDARY_CLASS =
  'flex flex-1 items-center justify-center gap-1.5 rounded-full! border border-hairline py-2 text-[12px] font-semibold text-[var(--ink-body)] transition-colors hover:bg-[var(--card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand';

const HistoryRecordDrawer = ({
  entry,
  results,
  linkedLabel,
  onClose,
  onDownload,
  onOpenLinked,
  onShare,
  onDiscuss,
}: HistoryRecordDrawerProps) => {
  if (!entry) return null;

  const meta = formatHistoryDateTime(entry.occurredAt);
  const note = entry.summary?.trim() || entry.subtitle?.trim() || '';

  return (
    <dialog
      open
      aria-label={`Record detail for ${entry.title}`}
      className="fixed inset-0 z-[60] m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-[var(--sh55)] p-0 backdrop-blur-sm md:items-stretch md:justify-end"
    >
      <button
        type="button"
        aria-label="Dismiss record detail"
        data-history-record-drawer="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <section
        aria-label={`Record detail for ${entry.title}`}
        className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-hairline bg-[var(--screen-2)] shadow-2xl md:h-full md:max-h-none md:w-[380px] md:rounded-none md:border-y-0 md:border-r-0"
      >
        <header className="flex flex-none items-start justify-between gap-2.5 border-b border-hairline px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className={MICRO_CAPTION_CLASS}>Record detail</span>
            <h2 className="truncate text-[15.5px] font-bold tracking-[-0.01em] text-[var(--ink)]">
              {entry.title}
            </h2>
            {meta ? <span className="text-[11.5px] text-[var(--ink-faint)]">{meta}</span> : null}
          </div>
          <button
            type="button"
            aria-label="Close record detail"
            onClick={onClose}
            className="flex size-[30px] flex-none items-center justify-center rounded-full! border border-hairline text-[var(--ink-faint)] transition-colors hover:bg-[var(--card-hover)]"
          >
            <IoClose size={14} aria-hidden="true" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {results.length > 0 ? (
            <div className="overflow-hidden rounded-[14px] border border-hairline bg-[var(--screen)]">
              <div className="grid grid-cols-[1fr_auto] gap-2 bg-[var(--screen-2)] px-3.5 py-2.5">
                <span className={MICRO_CAPTION_CLASS}>Analyte</span>
                <span className={MICRO_CAPTION_CLASS}>Result</span>
              </div>
              {results.map((result) => (
                <div
                  key={`${entry.id}-${result.label}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-hairline px-3.5 py-2.5 text-[12px]"
                >
                  <span className="font-semibold text-[var(--ink-body)]">{result.label}</span>
                  <span className="text-right font-bold tabular-nums text-[var(--ink)]">
                    {result.value || '-'}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {note ? (
            <div className="rounded-[12px] border border-[var(--divider)] bg-[var(--inset)] px-3.5 py-2.5 text-[12px] leading-relaxed text-[var(--ink-body)]">
              {note}
            </div>
          ) : null}

          {linkedLabel ? (
            <div className="flex flex-col gap-1.5">
              <span className={MICRO_CAPTION_CLASS}>Linked to</span>
              <button
                type="button"
                onClick={() => onOpenLinked(entry)}
                className="flex items-center gap-2 rounded-[12px] border border-hairline bg-[var(--screen)] px-3 py-2.5 text-[12px] font-semibold text-[var(--ink-body)] transition-colors hover:bg-[var(--card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
              >
                <IoCalendarOutline size={13} className="text-blue-text" aria-hidden="true" />
                <span className="truncate">{linkedLabel}</span>
                <IoChevronForwardOutline
                  size={12}
                  className="ml-auto flex-none text-[var(--ink-faint)]"
                  aria-hidden="true"
                />
              </button>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-none flex-col gap-2 border-t border-hairline px-5 pb-5 pt-3.5">
          <button
            type="button"
            onClick={() => onDownload(entry)}
            className="flex h-[42px] items-center justify-center gap-1.5 rounded-full! bg-[var(--cta)] text-[13px] font-semibold text-[var(--cta-text)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <IoDownloadOutline size={15} aria-hidden="true" />
            Download PDF
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => onShare(entry)} className={FOOTER_SECONDARY_CLASS}>
              <IoShareOutline size={13} aria-hidden="true" />
              Share to app
            </button>
            <button
              type="button"
              onClick={() => onDiscuss(entry)}
              className={FOOTER_SECONDARY_CLASS}
            >
              <IoChatbubbleEllipsesOutline size={13} aria-hidden="true" />
              Discuss in chat
            </button>
          </div>
        </footer>
      </section>
    </dialog>
  );
};

export default HistoryRecordDrawer;
