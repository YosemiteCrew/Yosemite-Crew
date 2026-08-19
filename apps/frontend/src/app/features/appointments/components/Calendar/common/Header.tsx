import React, { startTransition, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import { getMonthYear } from '@/app/features/appointments/components/Calendar/helpers';
import { getEmergencyPillStyle } from '@/app/features/appointments/components/appointmentBoardHelpers';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import Datepicker from '@/app/ui/inputs/Datepicker';
import {
  IoAdd,
  IoAddOutline,
  IoChevronBack,
  IoChevronDown,
  IoChevronForward,
  IoRemoveOutline,
} from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { Primary } from '@/app/ui/primitives/Buttons';
import SegmentedPill from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import StatusPill, { type StatusPillTokens } from '@/app/ui/primitives/StatusPill/StatusPill';
import { useHasMounted } from '@/app/hooks/useHasMounted';
import { useCalendarNavigation } from '@/app/hooks/useCalendarNavigation';
import { useCalendarWeekNavigation } from '@/app/features/appointments/components/Calendar/useCalendarSlots';
import { getStartOfWeek } from '@/app/features/appointments/components/Calendar/weekHelpers';
import StatusOptionButtons from '@/app/ui/filters/StatusOptionButtons';
import { useFilterDropdownDismiss } from '@/app/ui/filters/useFilterDropdownDismiss';

type FilterOption = { key: string; name: string; dotColor?: string };
type StatusOption = {
  key: string;
  name: string;
  bg?: string;
  text?: string;
  border?: string;
  dropdownText?: string;
};
const getDropdownStatusTextColor = (status: StatusOption): string =>
  status.dropdownText ?? status.text ?? 'var(--color-text-primary)';

const getStatusPillTokens = (status: StatusOption): StatusPillTokens => ({
  bg: status.bg ?? 'var(--color-pill-neutral-bg)',
  text: status.text ?? 'var(--color-pill-neutral-text)',
  border: status.border ?? status.bg ?? 'var(--color-pill-neutral-border)',
});

// Scope pills follow the planner's filter-row recipe: inactive is a bare
// --hairline outline with --ink-muted 600 type; the selected pill takes the
// shared --chip-selected-* ink fill and steps the label to 700.
const getFilterClassName = (filterKey: string, activeFilter: string): string => {
  if (filterKey !== activeFilter)
    return 'font-semibold text-[var(--ink-muted)] hover:bg-card-hover!';
  // The active emergency pill draws its fill/label from getEmergencyPillStyle's
  // inline style (--danger-strong with its paired ink); return no colour class so
  // an `!important` text colour can't override it (the old `text-danger-500!`
  // failed WCAG AA in dark mode).
  if (filterKey === 'emergencies') return 'font-bold';
  return 'bg-[var(--chip-selected-bg)] font-bold text-[var(--chip-selected-ink)]';
};

const getFilterBorderColor = (filterKey: string, activeFilter: string): string => {
  if (filterKey !== activeFilter) return 'var(--hairline)';
  /* v8 ignore next -- unreachable: only called for non-emergency pills (emergency pills use getEmergencyPillStyle) */
  if (filterKey === 'emergencies') return 'var(--color-danger-500)';
  return 'var(--chip-selected-border)';
};

const CALENDAR_VIEW_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'team', label: 'Team' },
];

/**
 * Fixed-position dropdown anchored to a trigger button: positions the panel
 * under the trigger's right edge, and closes on outside click or any scroll.
 * Shared by the status filter and the calendar-view selector.
 */
const useAnchoredDropdown = (minPanelWidth?: number) => {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const position = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
      minWidth: minPanelWidth === undefined ? rect.width : Math.max(rect.width, minPanelWidth),
      zIndex: 9999,
    });
  }, [minPanelWidth]);

  useLayoutEffect(() => {
    if (open) position();
  }, [open, position]);

  useFilterDropdownDismiss(open, setOpen, triggerRef, panelRef);

  return { open, setOpen, style, triggerRef, panelRef };
};

const StatusFilterDropdown = ({
  statusOptions,
  activeStatus,
  setActiveStatus,
  isMounted,
}: {
  statusOptions: StatusOption[];
  activeStatus?: string;
  setActiveStatus?: (v: string) => void;
  isMounted: boolean;
}) => {
  const { open, setOpen, style, triggerRef, panelRef } = useAnchoredDropdown(180);
  const selectedStatus = statusOptions.find((s) => s.key === activeStatus) ?? statusOptions[0];
  const isDefault = !selectedStatus || selectedStatus.key === 'all';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-1.5 rounded-full! transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        style={
          isDefault
            ? {
                padding: '6px 12px',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--hairline)',
                color: 'var(--ink-muted)',
              }
            : undefined
        }
      >
        {isDefault ? (
          <span className="text-[12px] font-semibold">All statuses</span>
        ) : (
          <StatusPill
            tokens={getStatusPillTokens(selectedStatus)}
            title={selectedStatus.name}
            label={
              <>
                {selectedStatus.name}
                <IoChevronDown
                  size={12}
                  className={clsx('shrink-0 transition-transform', open && 'rotate-180')}
                />
              </>
            }
          />
        )}
        {isDefault && (
          <IoChevronDown
            size={12}
            className={clsx('shrink-0 transition-transform', open && 'rotate-180')}
          />
        )}
      </button>

      {isMounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            className="rounded-2xl border border-card-border bg-neutral-0 shadow-[0_8px_24px_var(--color-shadow-soft)] overflow-hidden"
            style={style}
          >
            <StatusOptionButtons
              options={statusOptions}
              activeKey={activeStatus}
              allKey="all"
              onSelect={(key) => {
                setActiveStatus?.(key);
                setOpen(false);
              }}
              getTextColor={getDropdownStatusTextColor}
            />
          </div>,
          document.body
        )}
    </>
  );
};

const FilterPills = ({
  filterOptions,
  activeFilter,
  hasEmergency,
  onToggle,
}: {
  filterOptions: FilterOption[];
  activeFilter?: string;
  hasEmergency: boolean;
  onToggle: (filterKey: string) => void;
}) => {
  return (
    <>
      {filterOptions.map((filter) => {
        const isEmergencyFilter = filter.key === 'emergencies';
        const isActiveFilter = filter.key === activeFilter;
        const pillStyle = isEmergencyFilter
          ? getEmergencyPillStyle(isActiveFilter)
          : {
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: getFilterBorderColor(filter.key, activeFilter ?? ''),
            };

        return (
          <button
            key={filter.key}
            type="button"
            onClick={() => onToggle(filter.key)}
            className={clsx(
              'relative flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-[13px] py-1.5 rounded-full! text-[12px] transition-colors',
              getFilterClassName(filter.key, activeFilter ?? '')
            )}
            style={pillStyle}
          >
            {isEmergencyFilter && (
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--danger)' }}
              />
            )}
            {!isEmergencyFilter && filter.dotColor && (
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: filter.dotColor }}
              />
            )}
            <span>{filter.name}</span>
            {isEmergencyFilter && hasEmergency && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full"
                style={{
                  backgroundColor: 'var(--danger)',
                  outline: '2px solid var(--screen)',
                }}
              />
            )}
          </button>
        );
      })}
    </>
  );
};

// Round control inside a segmented/nav pill: the planner sizes these at 30px with
// a 14px glyph in --ink-faint, raising the selected one onto --screen.
const PILL_CONTROL_CLASS =
  'inline-flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full! transition-colors';

/** Zoom-toggle segment: the selected half lifts onto --screen, the other stays faint. */
const getZoomSegmentClass = (active: boolean): string =>
  `${PILL_CONTROL_CLASS} ${
    active
      ? 'bg-neutral-0 text-[var(--ink)] shadow-[0_1px_3px_var(--sh08)]'
      : 'text-[var(--ink-faint)] hover:text-[var(--ink)]'
  }`;

/** Track shared by the date-nav pill and the zoom toggle: 4px pad, --hairline, --field-bg. */
const PILL_TRACK_STYLE: React.CSSProperties = {
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--hairline)',
  backgroundColor: 'var(--field-bg)',
};

const ZoomToggle = ({
  zoomMode,
  setZoomMode,
}: {
  zoomMode: CalendarZoomMode;
  setZoomMode: React.Dispatch<React.SetStateAction<CalendarZoomMode>>;
}) => {
  const isZoomIn = zoomMode !== 'out';
  return (
    <div
      className="inline-flex shrink-0 items-center gap-1 rounded-full p-1"
      style={PILL_TRACK_STYLE}
    >
      <button
        type="button"
        onClick={() => setZoomMode('in')}
        title="Zoom in timeline"
        aria-label="Zoom in timeline"
        className={getZoomSegmentClass(isZoomIn)}
      >
        <IoAddOutline size={16} />
      </button>
      <button
        type="button"
        onClick={() => setZoomMode('out')}
        title="Zoom out timeline"
        aria-label="Zoom out timeline"
        className={getZoomSegmentClass(!isZoomIn)}
      >
        <IoRemoveOutline size={16} />
      </button>
    </div>
  );
};

/**
 * Date nav pill — prev arrow, current range label, next arrow on one --field-bg
 * track, per the planner header. The arrows step by week in the week view and by
 * day everywhere else, reusing the same navigation hooks the grids used before.
 */
const CalendarDateNav = ({
  label,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
}: {
  label: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) => (
  <div className="flex shrink-0 items-center gap-1 rounded-full p-1" style={PILL_TRACK_STYLE}>
    <button
      type="button"
      onClick={onPrev}
      aria-label={prevLabel}
      title={prevLabel}
      className={`${PILL_CONTROL_CLASS} text-[var(--ink-faint)] hover:text-[var(--ink)]`}
    >
      <IoChevronBack size={14} aria-hidden="true" />
    </button>
    <span className="whitespace-nowrap px-1.5 text-[13px] font-bold text-[var(--ink)]">
      {label}
    </span>
    <button
      type="button"
      onClick={onNext}
      aria-label={nextLabel}
      title={nextLabel}
      className={`${PILL_CONTROL_CLASS} text-[var(--ink-faint)] hover:text-[var(--ink)]`}
    >
      <IoChevronForward size={14} aria-hidden="true" />
    </button>
  </div>
);

type Headerprops = {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  /** Supplied by the week view so the header arrows step whole weeks. */
  setWeekStart?: React.Dispatch<React.SetStateAction<Date>>;
  zoomMode?: CalendarZoomMode;
  setZoomMode?: React.Dispatch<React.SetStateAction<CalendarZoomMode>>;
  activeCalendar?: string;
  setActiveCalendar?: React.Dispatch<React.SetStateAction<string>>;
  showAddButton?: boolean;
  onAddButtonClick?: () => void;
  /** The Tasks planner mounts this same header, so the CTA label is a prop. */
  addButtonText?: string;
  activeFilter?: string;
  setActiveFilter?: (v: string) => void;
  activeStatus?: string;
  setActiveStatus?: (v: string) => void;
  hasEmergency?: boolean;
  filterOptions?: FilterOption[];
  statusOptions?: StatusOption[];
};

const Header = ({
  setCurrentDate,
  currentDate,
  setWeekStart,
  zoomMode,
  setZoomMode,
  activeCalendar,
  setActiveCalendar,
  showAddButton = false,
  onAddButtonClick,
  addButtonText = 'New appointment',
  activeFilter,
  setActiveFilter,
  activeStatus,
  setActiveStatus,
  hasEmergency = false,
  filterOptions,
  statusOptions,
}: Headerprops) => {
  const onWheelHorizontal = useWheelToHorizontalScroll();
  const isMounted = useHasMounted();

  const handleFilterToggle = (filterKey: string) => {
    if (!setActiveFilter) return;
    setActiveFilter(activeFilter === filterKey ? 'all' : filterKey);
  };

  const { handlePrevDay, handleNextDay } = useCalendarNavigation(setCurrentDate);
  // Hooks must run unconditionally, so the week navigation is always built; the
  // no-op dispatch only ever runs when the week view did not hand down its state.
  const noopSetWeekStart = useCallback<React.Dispatch<React.SetStateAction<Date>>>(() => {}, []);
  const { handlePrevWeek, handleNextWeek } = useCalendarWeekNavigation(
    setWeekStart ?? noopSetWeekStart,
    setCurrentDate
  );
  const navigatesByWeek = activeCalendar === 'week' && !!setWeekStart;

  const handleToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    setWeekStart?.(getStartOfWeek(today));
  }, [setCurrentDate, setWeekStart]);

  return (
    <div
      className="sticky top-0 z-140 shrink-0 flex w-full items-center gap-4 border-b bg-neutral-0 px-4 py-2.5"
      style={{ borderColor: 'var(--hairline)' }}
    >
      <div className="flex shrink-0 items-center gap-2.5">
        <GlassTooltip content="Select date" side="bottom">
          <div className="relative z-150">
            <Datepicker
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              placeholder="Select Date"
            />
          </div>
        </GlassTooltip>
        <CalendarDateNav
          label={getMonthYear(currentDate)}
          prevLabel={navigatesByWeek ? 'Previous week' : 'Previous day'}
          nextLabel={navigatesByWeek ? 'Next week' : 'Next day'}
          onPrev={navigatesByWeek ? handlePrevWeek : handlePrevDay}
          onNext={navigatesByWeek ? handleNextWeek : handleNextDay}
        />
        <button
          type="button"
          onClick={handleToday}
          className="shrink-0 rounded-full! px-[13px] py-2 text-[12px] font-bold whitespace-nowrap transition-colors text-[var(--ink-body)] hover:bg-card-hover!"
          style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--hairline)' }}
        >
          Today
        </button>
      </div>

      <div
        className="min-w-0 flex-1 overflow-x-auto scrollbar-x-float py-1 -my-1"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
        onWheel={onWheelHorizontal}
      >
        <div className="flex w-max items-center gap-3 ml-auto">
          {activeCalendar && setActiveCalendar && (
            <SegmentedPill
              options={CALENDAR_VIEW_OPTIONS}
              value={activeCalendar}
              onChange={(next) => {
                if (next === activeCalendar) return;
                startTransition(() => setActiveCalendar(next));
              }}
              ariaLabel="Calendar view"
            />
          )}

          {statusOptions && statusOptions.length > 0 && (
            <StatusFilterDropdown
              statusOptions={statusOptions}
              activeStatus={activeStatus}
              setActiveStatus={setActiveStatus}
              isMounted={isMounted}
            />
          )}

          {filterOptions && (
            <FilterPills
              filterOptions={filterOptions}
              activeFilter={activeFilter}
              hasEmergency={hasEmergency}
              onToggle={handleFilterToggle}
            />
          )}

          {showAddButton && (
            <>
              <div
                className="h-6 w-px shrink-0"
                style={{ backgroundColor: 'var(--hairline)' }}
                aria-hidden="true"
              />
              <Primary
                text={addButtonText}
                ariaLabel={addButtonText}
                onClick={onAddButtonClick}
                icon={<IoAdd size={16} aria-hidden="true" />}
                className="w-fit shrink-0 justify-center py-0 whitespace-nowrap hover:scale-100"
              />
            </>
          )}

          {zoomMode && setZoomMode && <ZoomToggle zoomMode={zoomMode} setZoomMode={setZoomMode} />}
        </div>
      </div>
    </div>
  );
};

export default Header;
