'use client';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IoCalendarOutline,
  IoCheckmarkDoneOutline,
  IoEllipsisHorizontal,
  IoOpenOutline,
  IoPersonOutline,
  IoReaderOutline,
  IoSwapHorizontalOutline,
} from 'react-icons/io5';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import CompanionCard from '@/app/ui/cards/CompanionCard/CompanionCard';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import { Appointment } from '@yosemite-crew/types';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';

import { getAgeInYears } from '@/app/lib/date';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { toTitleCase } from '@/app/lib/validators';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { buildCompanionOverviewHref } from '@/app/lib/companionHistoryRoute';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

import { getCompanionStatusStyle } from '@/app/ui/tables/tableUtils';

import './DataTable.css';

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Canine',
  cat: 'Feline',
  horse: 'Equine',
  other: 'Other',
};

const PAGE_SIZE = 10;

// Shared column template so the header row and every body row stay locked in
// step. Patient · Parent · Breed · Upcoming visit · Status · kebab.
const GRID_COLS =
  'grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_120px_48px] items-center gap-3';

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
  const age = getAgeInYears(companion.dateOfBirth);
  if (Number.isFinite(age) && age >= 0) parts.push(`${age} ${age === 1 ? 'Yr' : 'Yrs'}`);
  return parts.join(' · ');
};

type RowMenuAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
};

// Row kebab: replaces the old row of icon buttons with a single overflow menu
// (Open overview / View profile / Book appointment / Add task / Change status),
// matching the design's row-actions popover. Rendered through a portal so the
// card's overflow:hidden never clips it.
const RowMenu = ({ actions, label }: { actions: RowMenuAction[]; label: string }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

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

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleScroll = () => setOpen(false);
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
        onClick={() => setOpen((value) => !value)}
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
              className="flex flex-col gap-px rounded-[15px] border border-[var(--hairline)] bg-[var(--screen)] p-[7px] shadow-[0_24px_60px_var(--sh28)]"
            >
              {actions.map((action, index) => {
                const dividerBefore = action.key === 'change-status' && index > 0;
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
                        setOpen(false);
                      }}
                      className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold text-text-primary transition-colors hover:bg-[var(--surface-soft)]"
                    >
                      <span className="flex text-[var(--ink-faint)]" aria-hidden="true">
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
}: CompanionsTableProps) => {
  const terminologyText = useCompanionTerminologyText();
  const router = useRouter();
  const appointments = useAppointmentsForPrimaryOrg();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(
    () => filteredList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredList, page]
  );

  const getUpcomingAppointmentForCompanion = (companionId?: string) => {
    if (!companionId) return null;
    const now = Date.now();
    const upcomingStatuses = new Set(['REQUESTED', 'UPCOMING', 'CHECKED_IN', 'IN_PROGRESS']);

    const related = appointments
      .filter(
        (appointment) =>
          appointment?.companion?.id === companionId &&
          upcomingStatuses.has(String(appointment.status ?? '').toUpperCase())
      )
      .sort(
        (a, b) =>
          new Date(a.startTime ?? a.appointmentDate).getTime() -
          new Date(b.startTime ?? b.appointmentDate).getTime()
      );

    if (related.length === 0) return null;
    return (
      related.find(
        (appointment) =>
          new Date(appointment.startTime ?? appointment.appointmentDate).getTime() >= now
      ) ?? related[0]
    );
  };

  const goToAppointment = (appointment: Appointment) => {
    if (!appointment?.id) return;
    const params = new URLSearchParams({
      appointmentId: appointment.id,
    });
    router.push(`/appointments?${params.toString()}`);
  };

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

  const rangeStart = filteredList.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredList.length);

  return (
    <div className="table-wrapper companions-scroll-x h-full min-h-0 overflow-hidden">
      <div className="table-list hidden xl:flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
          {/* Header row */}
          <div
            className={`${GRID_COLS} shrink-0 bg-[var(--screen-2)] px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]`}
          >
            <span>{terminologyText('Patient')}</span>
            <span>Parent</span>
            <span>Breed</span>
            <span>Upcoming visit</span>
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
              pageItems.map((item) => {
                const upcoming = getUpcomingAppointmentForCompanion(item.companion.id);
                return (
                  <div
                    key={item.companion.id || item.companion.name}
                    className={`${GRID_COLS} border-t border-[var(--hairline)] px-5 py-[11px] text-[14px] text-text-primary transition-colors hover:bg-[var(--surface-soft)]`}
                  >
                    {/* Patient */}
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="size-[34px] shrink-0 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                        <Image
                          src={getSafeImageUrl(
                            item.companion.photoUrl,
                            item.companion.type.toLowerCase() as ImageType
                          )}
                          alt=""
                          height={34}
                          width={34}
                          className="size-full object-cover"
                        />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <button
                          type="button"
                          onClick={() => handleOpenCompanionHistoryPage(item)}
                          title={terminologyText('Open companion history')}
                          className="truncate text-left text-[14px] font-bold text-text-primary underline-offset-2 hover:underline"
                        >
                          {formatCompanionNameWithOwnerLastName(item.companion.name, item.parent)}
                        </button>
                        <span className="truncate text-[12px] text-[var(--ink-faint)]">
                          {buildSpeciesLine(item.companion)}
                        </span>
                      </span>
                    </span>

                    {/* Parent */}
                    <span className="truncate text-[var(--ink-muted)]">
                      {formatParentName(item.parent)}
                    </span>

                    {/* Breed */}
                    <span className="truncate text-[var(--ink-muted)]">
                      {formatDisplayValue(item.companion.breed)}
                    </span>

                    {/* Upcoming visit */}
                    {upcoming ? (
                      <button
                        type="button"
                        onClick={() => goToAppointment(upcoming)}
                        title="Open appointment"
                        className="flex min-w-0 items-center gap-2 rounded-[10px] border border-[var(--hairline)] px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--surface-soft)]"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px] text-text-primary">
                            {formatDateLabel(upcoming.appointmentDate)}
                          </span>
                          <span className="truncate text-[12px] text-[var(--ink-faint)]">
                            {formatTimeLabel(upcoming.startTime)}
                          </span>
                        </span>
                        <IoOpenOutline
                          size={14}
                          aria-hidden="true"
                          className="ml-auto shrink-0 text-[var(--ink-faint)]"
                        />
                      </button>
                    ) : (
                      <span className="text-[var(--ink-faint)]">-</span>
                    )}

                    {/* Status */}
                    <span>
                      <span
                        className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                        style={getCompanionStatusStyle(item.companion.status || 'inactive')}
                      >
                        {toTitleCase(item.companion.status || 'inactive')}
                      </span>
                    </span>

                    {/* Row menu */}
                    <RowMenu
                      label={terminologyText('Companion row actions')}
                      actions={buildRowActions(item)}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Footer / pagination */}
          {filteredList.length > 0 ? (
            <div className="flex shrink-0 items-center justify-between border-t border-[var(--hairline)] px-5 py-3 text-[12.5px] text-[var(--ink-faint)]">
              <span>{`Showing ${rangeStart}-${rangeEnd} of ${filteredList.length} ${terminologyText('companions')}`}</span>
              {totalPages > 1 ? (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="flex size-7 items-center justify-center rounded-[9px] border border-[var(--hairline)] text-text-primary transition-colors hover:bg-[var(--surface-soft)] disabled:opacity-40"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      aria-label={`Page ${pageNumber}`}
                      aria-current={pageNumber === page ? 'page' : undefined}
                      onClick={() => setPage(pageNumber)}
                      className={`flex size-7 items-center justify-center rounded-[9px] text-[12px] transition-colors ${
                        pageNumber === page
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
                    disabled={page === totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    className="flex size-7 items-center justify-center rounded-[9px] border border-[var(--hairline)] text-text-primary transition-colors hover:bg-[var(--surface-soft)] disabled:opacity-40"
                  >
                    ›
                  </button>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card-list flex xl:hidden gap-4 sm:gap-6 flex-wrap">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((companion, index) => (
            <CompanionCard
              key={index + companion.companion.name}
              companion={companion}
              handleViewCompanion={handleViewCompanion}
              handleBookAppointment={handleBookAppointment}
              handleAddTask={handleAddTask}
              handleChangeStatus={handleChangeStatus}
              canEditAppointments={canEditAppointments}
              canEditTasks={canEditTasks}
              canEditCompanions={canEditCompanions}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default CompanionsTable;
