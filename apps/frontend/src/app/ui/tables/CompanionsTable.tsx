'use client';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IoCalendarOutline,
  IoCheckmarkDoneOutline,
  IoChevronForwardOutline,
  IoEllipsisHorizontal,
  IoPersonOutline,
  IoReaderOutline,
  IoSwapHorizontalOutline,
} from 'react-icons/io5';
import { useRouter } from 'next/navigation';

import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import { AppointmentWithCompanion } from '@/app/features/appointments/types/appointments';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useIsPhone } from '@/app/ui/layout/PhoneShell/useIsPhone';

import { formatCompanionAge } from '@/app/lib/date';
import SharedCompanionAvatar from '@/app/ui/avatars/CompanionAvatar';
import { toTitleCase } from '@/app/lib/validators';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { buildCompanionOverviewHref } from '@/app/lib/companionHistoryRoute';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

import {
  getCompanionRowStatusColor,
  getLastVisit,
  hasCoParent,
  isToday,
} from '@/app/features/companions/pages/Companions/companionsDirectory';

import './DataTable.css';

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Dog',
  cat: 'Cat',
  horse: 'Horse',
  other: 'Other',
};

const PAGE_SIZE = 10;

export type CompanionsViewMode = 'list' | 'grid';

// Patient · Parent · Breed · Last visit · Patient ID · Status · kebab. The
// Patient ID column is pruned below the xl (desktop) breakpoint per the design.
const GRID_COLS =
  'grid grid-cols-[minmax(0,1.7fr)_minmax(0,1.25fr)_minmax(0,1.15fr)_minmax(0,0.95fr)_110px_44px] xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1.25fr)_minmax(0,1.15fr)_minmax(0,0.95fr)_100px_110px_44px] items-center gap-3';

type CompanionsTableProps = {
  filteredList: CompanionParent[];
  setActiveCompanion: (companion: CompanionParent) => void;
  setViewCompanion: (open: boolean) => void;
  setCompanionInfoInitialLabel?: (label: 'info' | 'history') => void;
  setBookAppointment: (open: boolean) => void;
  setAddTask: (open: boolean) => void;
  setChangeStatusPopup: (open: boolean) => void;
  canEditAppointments: boolean;
  canEditTasks: boolean;
  canEditCompanions: boolean;
  viewMode?: CompanionsViewMode;
};

const formatDisplayValue = (value?: string | null, fallback = '-') => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return fallback;
  return toTitleCase(normalized);
};

const formatParentName = (parent: CompanionParent['parent']): string => {
  const name = [parent?.firstName, parent?.lastName].filter(Boolean).join(' ').trim();
  return name || '-';
};

const buildSpeciesLine = (companion: CompanionParent['companion']): string => {
  const species = SPECIES_LABEL[companion.type?.toLowerCase()] ?? toTitleCase(companion.type);
  const parts: string[] = [species];
  if (companion.gender) parts.push(toTitleCase(companion.gender));
  const age = formatCompanionAge(companion.dateOfBirth);
  if (age) parts.push(age);
  return parts.join(' · ');
};

const formatPatientId = (companionId?: string): string => {
  const normalized = String(companionId ?? '').trim();
  if (!normalized) return '-';
  return normalized.length > 10 ? `${normalized.slice(0, 10)}…` : normalized;
};

const formatLastVisitLabel = (visit: AppointmentWithCompanion | null): string => {
  if (!visit) return '-';
  const start = visit.startTime ?? visit.appointmentDate;
  if (isToday(start)) return `Today · ${formatTimeLabel(start)}`;
  return formatDateLabel(start);
};

// Photo when the companion has one, otherwise a Newsreader monogram on a tinted
// disc — the warm-bone directory avatar.
const CompanionAvatar = ({
  companion,
  size,
  textClassName,
}: {
  companion: CompanionParent['companion'];
  size: number;
  textClassName: string;
}) => (
  <SharedCompanionAvatar
    photoUrl={companion.photoUrl}
    name={companion.name}
    speciesType={companion.type}
    seed={companion.id || companion.name}
    size={size}
    textClassName={textClassName}
  />
);

const CoParentPill = () => (
  <span className="ml-1 inline-flex items-center rounded-full border border-[var(--pink)] bg-[var(--glow-p12)] px-[7px] py-px text-[9px] font-bold text-[var(--pink)]">
    + CO-PARENT
  </span>
);

const StatusDot = ({ status, className = '' }: { status?: string; className?: string }) => (
  <span
    className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.09em] ${className}`}
    style={{ color: getCompanionRowStatusColor(status) }}
  >
    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
    {toTitleCase(status || 'inactive')}
  </span>
);

type RowMenuAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
};

// Row kebab: a single overflow menu (Open overview / View profile / Book
// appointment / Add task / Change status). Rendered through a portal so the
// card's overflow:hidden never clips it. `onOpenChange` lets the row light up
// while its menu is open, matching the design's active-row highlight.
const RowMenu = ({
  actions,
  label,
  onOpenChange,
}: {
  actions: RowMenuAction[];
  label: string;
  onOpenChange?: (open: boolean) => void;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  const changeOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  const position = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 224;
    const left = Math.max(8, rect.right - width);
    setStyle({ position: 'fixed', top: rect.bottom + 6, left, width, zIndex: 5000 });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    position();
  }, [open, position]);

  // Keep the latest close action in a ref so the dismiss listeners subscribe
  // once per open (deps: [open]) instead of re-subscribing whenever the parent
  // re-creates onOpenChange.
  const closeMenuRef = useRef(() => changeOpen(false));
  closeMenuRef.current = () => changeOpen(false);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeMenuRef.current();
    };
    const handleScroll = () => closeMenuRef.current();
    document.addEventListener('mousedown', handlePointer);
    globalThis.window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    globalThis.window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      globalThis.window.removeEventListener('scroll', handleScroll, { capture: true });
      globalThis.window.removeEventListener('resize', handleScroll);
    };
  }, [open]);

  return (
    <div className="flex justify-center">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => changeOpen(!open)}
        className={`flex size-7 items-center justify-center rounded-[9px] transition-colors ${
          open
            ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active)]'
            : 'text-[var(--ink-faint)] hover:bg-[var(--surface-soft)] hover:text-text-primary'
        }`}
      >
        <IoEllipsisHorizontal size={16} aria-hidden="true" />
      </button>
      {open && style && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={style}
              className="yc-glass-overlay flex flex-col gap-px rounded-[15px] p-[7px]"
            >
              {actions.map((action, index) => {
                const dividerBefore = action.key === 'change-status' && index > 0;
                const isPrimary = action.key === 'open-overview';
                return (
                  <React.Fragment key={action.key}>
                    {dividerBefore ? (
                      <span className="mx-2 my-1 h-px bg-[var(--hairline)]" aria-hidden="true" />
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        action.onSelect();
                        changeOpen(false);
                      }}
                      className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ${
                        isPrimary
                          ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active)]'
                          : 'text-text-primary hover:bg-[var(--surface-soft)]'
                      }`}
                    >
                      <span
                        className={`flex ${isPrimary ? '' : 'text-[var(--ink-faint)]'}`}
                        aria-hidden="true"
                      >
                        {action.icon}
                      </span>
                      {action.label}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

const CompanionRow = ({
  item,
  lastVisitLabel,
  actions,
  terminologyText,
  onOpenHistory,
}: {
  item: CompanionParent;
  lastVisitLabel: string;
  actions: RowMenuAction[];
  terminologyText: (label: string) => string;
  onOpenHistory: (companion: CompanionParent) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isInactive = String(item.companion.status ?? 'inactive').toLowerCase() !== 'active';
  return (
    <div
      className={`${GRID_COLS} border-t border-[var(--hairline)] px-5 py-[11px] text-[14px] text-text-primary transition-colors ${
        menuOpen ? 'bg-[var(--surface-soft)]' : 'hover:bg-[var(--surface-soft)]'
      } ${isInactive ? 'opacity-[0.62]' : ''}`}
    >
      {/* Patient */}
      <span className="flex min-w-0 items-center gap-3">
        <CompanionAvatar companion={item.companion} size={38} textClassName="text-[17px]" />
        <span className="flex min-w-0 flex-col">
          <button
            type="button"
            onClick={() => onOpenHistory(item)}
            title={terminologyText('Open companion history')}
            className="truncate text-left font-newsreader text-[16.5px] tracking-[-0.01em] text-[var(--ink)] underline-offset-2 hover:underline"
          >
            {formatCompanionNameWithOwnerLastName(item.companion.name, item.parent)}
          </button>
          <span className="truncate text-[11.5px] text-[var(--ink-faint)]">
            {buildSpeciesLine(item.companion)}
          </span>
        </span>
      </span>

      {/* Parent */}
      <span className="min-w-0 truncate text-[var(--ink-muted)]">
        {formatParentName(item.parent)}
        {hasCoParent(item) ? <CoParentPill /> : null}
      </span>

      {/* Breed */}
      <span className="truncate font-newsreader text-[14.5px] italic text-[var(--ink-muted)]">
        {formatDisplayValue(item.companion.breed)}
      </span>

      {/* Last visit */}
      <span className="truncate text-[13px] text-text-primary">{lastVisitLabel}</span>

      {/* Patient ID (desktop only) */}
      <span className="hidden truncate text-[12.5px] tabular-nums text-[var(--ink-faint)] xl:block">
        {formatPatientId(item.companion.id)}
      </span>

      {/* Status */}
      <span>
        <StatusDot status={item.companion.status} />
      </span>

      {/* Row menu */}
      <RowMenu
        label={terminologyText('Companion row actions')}
        actions={actions}
        onOpenChange={setMenuOpen}
      />
    </div>
  );
};

// Grid card (desktop grid view) + phone list card share the same avatar/name/
// status vocabulary; the grid card leans on the larger media block.
const CompanionGridCard = ({
  item,
  actions,
  terminologyText,
  onOpen,
}: {
  item: CompanionParent;
  actions: RowMenuAction[];
  terminologyText: (label: string) => string;
  onOpen: (companion: CompanionParent) => void;
}) => {
  const isInactive = String(item.companion.status ?? 'inactive').toLowerCase() !== 'active';
  return (
    <div
      className={`flex flex-col justify-between gap-3 overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] p-3.5 shadow-[0_1px_2px_var(--sh03),0_10px_26px_var(--sh05)] ${
        isInactive ? 'opacity-[0.62]' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <CompanionAvatar companion={item.companion} size={46} textClassName="text-[20px]" />
        <button
          type="button"
          onClick={() => onOpen(item)}
          title={terminologyText('Open companion history')}
          className="flex min-w-0 flex-col text-left"
        >
          <span className="truncate font-newsreader text-[17px] tracking-[-0.01em] text-[var(--ink)]">
            {formatCompanionNameWithOwnerLastName(item.companion.name, item.parent)}
          </span>
          <span className="truncate text-[11.5px] text-[var(--ink-faint)]">
            {formatDisplayValue(item.companion.breed)} · {formatParentName(item.parent)}
          </span>
        </button>
      </div>
      <div className="flex items-center justify-between">
        <StatusDot status={item.companion.status} />
        <RowMenu label={terminologyText('Companion row actions')} actions={actions} />
      </div>
    </div>
  );
};

const CompanionPhoneCard = ({
  item,
  onOpen,
  terminologyText,
}: {
  item: CompanionParent;
  onOpen: (companion: CompanionParent) => void;
  terminologyText: (label: string) => string;
}) => {
  const isInactive = String(item.companion.status ?? 'inactive').toLowerCase() !== 'active';
  const subline = [
    formatDisplayValue(item.companion.breed, ''),
    formatParentName(item.parent),
    toTitleCase(item.companion.status || 'inactive'),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      title={terminologyText('Open companion history')}
      className={`flex w-full items-center gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] px-3.5 py-2.5 text-left shadow-[0_1px_2px_var(--sh03),0_10px_26px_var(--sh05)] ${
        isInactive ? 'opacity-[0.62]' : ''
      }`}
    >
      <CompanionAvatar companion={item.companion} size={44} textClassName="text-[18px]" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1">
          <span className="truncate font-newsreader text-[16px] tracking-[-0.01em] text-[var(--ink)]">
            {formatCompanionNameWithOwnerLastName(item.companion.name, item.parent)}
          </span>
          {hasCoParent(item) ? <CoParentPill /> : null}
        </span>
        <span className="truncate text-[12px] text-[var(--ink-faint)]">{subline}</span>
      </span>
      <IoChevronForwardOutline
        size={16}
        aria-hidden="true"
        className="shrink-0 text-[var(--ink-faint)]"
      />
    </button>
  );
};

const TablePagination = ({
  rangeStart,
  rangeEnd,
  totalItems,
  companionsLabel,
  totalPages,
  safePage,
  onPageChange,
}: {
  rangeStart: number;
  rangeEnd: number;
  totalItems: number;
  companionsLabel: string;
  totalPages: number;
  safePage: number;
  onPageChange: (page: number) => void;
}) => (
  <div className="flex shrink-0 items-center justify-between border-t border-[var(--hairline)] px-5 py-3 text-[12.5px] text-[var(--ink-faint)]">
    <span>{`Showing ${rangeStart}-${rangeEnd} of ${totalItems} ${companionsLabel}`}</span>
    {totalPages > 1 ? (
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          disabled={safePage === 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className="flex size-7 items-center justify-center rounded-[9px] border border-[var(--hairline)] text-text-primary transition-colors hover:bg-[var(--surface-soft)] disabled:opacity-40"
        >
          ‹
        </button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            aria-label={`Page ${pageNumber}`}
            aria-current={pageNumber === safePage ? 'page' : undefined}
            onClick={() => onPageChange(pageNumber)}
            className={`flex size-7 items-center justify-center rounded-[9px] text-[12px] transition-colors ${
              pageNumber === safePage
                ? 'bg-[var(--nav-active-bg)] font-bold text-[var(--nav-active)]'
                : 'font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-soft)]'
            }`}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          aria-label="Next page"
          disabled={safePage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className="flex size-7 items-center justify-center rounded-[9px] border border-[var(--hairline)] text-text-primary transition-colors hover:bg-[var(--surface-soft)] disabled:opacity-40"
        >
          ›
        </button>
      </span>
    ) : null}
  </div>
);

const CompanionsTable = ({
  filteredList,
  setActiveCompanion,
  setViewCompanion,
  setCompanionInfoInitialLabel,
  setBookAppointment,
  setAddTask,
  setChangeStatusPopup,
  canEditAppointments,
  canEditTasks,
  canEditCompanions,
  viewMode = 'list',
}: CompanionsTableProps) => {
  const terminologyText = useCompanionTerminologyText();
  const router = useRouter();
  const appointments = useAppointmentsForPrimaryOrg();
  const isPhone = useIsPhone();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  // Clamp the effective page during render instead of correcting it in an effect,
  // so the list never flashes an out-of-range (empty) slice after the list shrinks.
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => filteredList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredList, safePage]
  );

  const lastVisitLabelFor = (companionId?: string): string =>
    formatLastVisitLabel(getLastVisit(appointments, companionId));

  const handleViewCompanion = (companion: CompanionParent) => {
    setActiveCompanion(companion);
    setCompanionInfoInitialLabel?.('info');
    setViewCompanion(true);
  };

  const handleBookAppointment = (companion: CompanionParent) => {
    setActiveCompanion(companion);
    setBookAppointment(true);
  };

  const handleAddTask = (companion: CompanionParent) => {
    setActiveCompanion(companion);
    setAddTask(true);
  };

  const handleChangeStatus = (companion: CompanionParent) => {
    setActiveCompanion(companion);
    setChangeStatusPopup(true);
  };

  const handleOpenCompanionHistoryPage = (companion: CompanionParent) => {
    const companionId = String(companion.companion.id ?? '').trim();
    if (!companionId) return;

    router.push(
      buildCompanionOverviewHref(
        companionId,
        `/companions?${new URLSearchParams({ companionId }).toString()}`
      )
    );
  };

  const buildRowActions = (companion: CompanionParent): RowMenuAction[] => {
    const actions: RowMenuAction[] = [
      {
        key: 'open-overview',
        label: terminologyText('Open overview'),
        icon: <IoReaderOutline size={15} aria-hidden="true" />,
        onSelect: () => handleOpenCompanionHistoryPage(companion),
      },
      {
        key: 'view-profile',
        label: terminologyText('View profile'),
        icon: <IoPersonOutline size={15} aria-hidden="true" />,
        onSelect: () => handleViewCompanion(companion),
      },
    ];
    if (canEditAppointments) {
      actions.push({
        key: 'book-appointment',
        label: 'Book appointment',
        icon: <IoCalendarOutline size={15} aria-hidden="true" />,
        onSelect: () => handleBookAppointment(companion),
      });
    }
    if (canEditTasks) {
      actions.push({
        key: 'add-task',
        label: 'Add task',
        icon: <IoCheckmarkDoneOutline size={15} aria-hidden="true" />,
        onSelect: () => handleAddTask(companion),
      });
    }
    if (canEditCompanions) {
      actions.push({
        key: 'change-status',
        label: 'Change status',
        icon: <IoSwapHorizontalOutline size={15} aria-hidden="true" />,
        onSelect: () => handleChangeStatus(companion),
      });
    }
    return actions;
  };

  const rangeStart = filteredList.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredList.length);

  // Phone: lean tappable cards.
  if (isPhone) {
    return (
      <div className="flex flex-col gap-2.5">
        {filteredList.length === 0 ? (
          <div className="w-full py-6 text-center text-[14px] text-[var(--ink-muted)]">
            No data available
          </div>
        ) : (
          filteredList.map((item) => (
            <CompanionPhoneCard
              key={item.companion.id || item.companion.name}
              item={item}
              onOpen={handleOpenCompanionHistoryPage}
              terminologyText={terminologyText}
            />
          ))
        )}
      </div>
    );
  }

  return (
    <div className="table-wrapper companions-scroll-x h-full min-h-0 overflow-hidden">
      <div className="companions-table-list flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
          {viewMode === 'grid' ? (
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hidden p-4">
              {pageItems.length === 0 ? (
                <div className="flex h-full items-center justify-center px-5 py-10 text-[14px] text-[var(--ink-muted)]">
                  No data available
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                  {pageItems.map((item) => (
                    <CompanionGridCard
                      key={item.companion.id || item.companion.name}
                      item={item}
                      actions={buildRowActions(item)}
                      terminologyText={terminologyText}
                      onOpen={handleOpenCompanionHistoryPage}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Header row */}
              <div
                className={`${GRID_COLS} shrink-0 bg-[var(--screen-2)] px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]`}
              >
                <span>{terminologyText('Patient')}</span>
                <span>Parent</span>
                <span>Breed</span>
                <span>Last visit</span>
                <span className="hidden xl:block">Patient ID</span>
                <span>Status</span>
                <span aria-hidden="true" />
              </div>

              {/* Rows */}
              <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hidden">
                {pageItems.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-5 py-10 text-[14px] text-[var(--ink-muted)]">
                    No data available
                  </div>
                ) : (
                  pageItems.map((item) => (
                    <CompanionRow
                      key={item.companion.id || item.companion.name}
                      item={item}
                      lastVisitLabel={lastVisitLabelFor(item.companion.id)}
                      actions={buildRowActions(item)}
                      terminologyText={terminologyText}
                      onOpenHistory={handleOpenCompanionHistoryPage}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* Footer / pagination */}
          {filteredList.length > 0 ? (
            <TablePagination
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              totalItems={filteredList.length}
              companionsLabel={terminologyText('companions')}
              totalPages={totalPages}
              safePage={safePage}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CompanionsTable;
