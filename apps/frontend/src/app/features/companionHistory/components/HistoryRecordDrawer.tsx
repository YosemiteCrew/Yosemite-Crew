import React from 'react';
import {
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoChevronForwardOutline,
  IoDownloadOutline,
  IoOpenOutline,
  IoShareOutline,
} from 'react-icons/io5';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { HistoryEntry } from '@/app/features/companionHistory/types/history';
import {
  formatHistoryDateTime,
  getPrimaryActionLabel,
  resolveHistoryDocumentId,
} from '@/app/features/companionHistory/utils/historyFormatters';
import '@/app/ui/tables/GenericTable/Generictable.css';

export type RecordDetailPair = {
  label: string;
  value: string;
  /** Reference interval for the analyte, shown in the design's third column. */
  range?: string;
  /** Out-of-range result: the row takes the warn tint. */
  abnormal?: boolean;
  /** Arrow appended to the analyte name when the direction is known. */
  direction?: string;
};

type HistoryRecordDrawerProps = {
  entry: HistoryEntry | null;
  results: RecordDetailPair[];
  linkedLabel: string | null;
  onClose: () => void;
  /** Only invoked for records that resolve to a stored document. */
  onDownload: (entry: HistoryEntry) => void;
  /** Type-aware open path for records that are not documents (lab, invoice, task, ...). */
  onView: (entry: HistoryEntry) => void;
  onOpenLinked: (entry: HistoryEntry) => void;
  onShare: (entry: HistoryEntry) => void;
  onDiscuss: (entry: HistoryEntry) => void;
};

const TITLE_ID = 'history-record-drawer-title';

const MICRO_CAPTION_CLASS =
  'text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]';

// Design results table: Analyte 1fr / Result 72px / Range 90px, with abnormal
// rows carrying the warn tint across every cell.
const RESULT_GRID_CLASS = 'grid grid-cols-[1fr_72px_90px] gap-2 px-3.5';

const ResultRow = ({ result }: { result: RecordDetailPair }) => {
  const tint = result.abnormal ? 'var(--warn-text)' : undefined;
  return (
    <div
      className={`${RESULT_GRID_CLASS} items-center border-t border-hairline py-2.5 text-[12px]`}
      style={result.abnormal ? { background: 'var(--warn-bg)' } : undefined}
    >
      <span
        className={result.abnormal ? 'font-bold' : 'font-semibold'}
        style={{ color: tint ?? 'var(--ink-body)' }}
      >
        {result.direction ? `${result.label} ${result.direction}` : result.label}
      </span>
      <span className="font-bold tabular-nums" style={{ color: tint ?? 'var(--ink)' }}>
        {result.value || '-'}
      </span>
      <span className="tabular-nums" style={{ color: tint ?? 'var(--ink-faint)' }}>
        {result.range || '-'}
      </span>
    </div>
  );
};

/**
 * The footer's primary action, matched to what the record actually is. Records
 * held in the document store download through the document endpoint; every other
 * type (lab result, invoice, task, appointment, form) keeps its own open path,
 * whose id the download endpoint could never resolve.
 */
const RecordPrimaryAction = ({
  entry,
  onDownload,
  onView,
}: {
  entry: HistoryEntry;
  onDownload: (entry: HistoryEntry) => void;
  onView: (entry: HistoryEntry) => void;
}) => {
  if (resolveHistoryDocumentId(entry)) {
    return (
      <Primary
        text="Download PDF"
        icon={<IoDownloadOutline aria-hidden="true" />}
        onClick={() => onDownload(entry)}
      />
    );
  }
  return (
    <Primary
      text={getPrimaryActionLabel(entry)}
      icon={<IoOpenOutline aria-hidden="true" />}
      onClick={() => onView(entry)}
    />
  );
};

const HistoryRecordDrawer = ({
  entry,
  results,
  linkedLabel,
  onClose,
  onDownload,
  onView,
  onOpenLinked,
  onShare,
  onDiscuss,
}: HistoryRecordDrawerProps) => {
  if (!entry) return null;

  const meta = formatHistoryDateTime(entry.occurredAt);
  const note = entry.summary?.trim() || entry.subtitle?.trim() || '';

  return (
    <Modal showModal setShowModal={() => onClose()} size="sm" aria-labelledby={TITLE_ID}>
      <div className="flex h-full flex-col gap-4">
        <ModalHeader
          eyebrow="Record detail"
          title={entry.title}
          meta={meta || undefined}
          onClose={onClose}
          titleId={TITLE_ID}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {results.length > 0 ? (
            <div className="overflow-hidden rounded-[14px] border border-hairline bg-[var(--screen)]">
              <div className={`${RESULT_GRID_CLASS} yc-table-head yc-table-head--static px-3.5!`}>
                <span>Analyte</span>
                <span>Result</span>
                <span>Range</span>
              </div>
              {results.map((result) => (
                <ResultRow key={`${entry.id}-${result.label}`} result={result} />
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

        <ModalFooter align="stretch">
          <div className="flex flex-col gap-2">
            <RecordPrimaryAction entry={entry} onDownload={onDownload} onView={onView} />
            <div className="flex gap-2 [&>*]:flex-1">
              <Secondary
                size="small"
                text="Share to app"
                icon={<IoShareOutline aria-hidden="true" />}
                onClick={() => onShare(entry)}
              />
              <Secondary
                size="small"
                text="Discuss in chat"
                icon={<IoChatbubbleEllipsesOutline aria-hidden="true" />}
                onClick={() => onDiscuss(entry)}
              />
            </div>
          </div>
        </ModalFooter>
      </div>
    </Modal>
  );
};

export default HistoryRecordDrawer;
