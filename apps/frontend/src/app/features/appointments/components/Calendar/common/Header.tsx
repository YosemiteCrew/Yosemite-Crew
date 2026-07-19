import React, {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import { getMonthYear } from '@/app/features/appointments/components/Calendar/helpers';
import { getEmergencyPillStyle } from '@/app/features/appointments/components/appointmentBoardHelpers';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import Datepicker from '@/app/ui/inputs/Datepicker';
import { IoAdd, IoAddOutline, IoChevronDown, IoRemoveOutline } from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { Primary } from '@/app/ui/primitives/Buttons';
import SegmentedPill from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import { useHasMounted } from '@/app/hooks/useHasMounted';

type FilterOption = { key: string; name: string };
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

const getFilterClassName = (filterKey: string, activeFilter: string): string => {
  if (filterKey !== activeFilter) return 'text-text-tertiary hover:bg-card-hover!';
  // The active emergency pill draws its fill/label from getEmergencyPillStyle's
  // inline style (AA-safe white on --color-danger-800); return no colour class so
  // an `!important` text colour can't override it (the old `text-danger-500!`
  // failed WCAG AA in dark mode).
  if (filterKey === 'emergencies') return '';
  return 'bg-blue-light text-blue-text!';
};

const getFilterBorderColor = (filterKey: string, activeFilter: string): string => {
  if (filterKey !== activeFilter) return 'var(--color-card-border)';
  /* v8 ignore next -- unreachable: only called for non-emergency pills (emergency pills use getEmergencyPillStyle) */
  if (filterKey === 'emergencies') return 'var(--color-danger-500)';
  return 'var(--color-text-brand)';
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

  useEffect(() => {
    if (!open) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open]);

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
  const dropdown = useAnchoredDropdown(180);
  const selectedStatus = statusOptions.find((s) => s.key === activeStatus) ?? statusOptions[0];
  const isDefault = !selectedStatus || selectedStatus.key === 'all';

  return (
    <>
      <button
        ref={dropdown.triggerRef}
        type="button"
        onClick={() => dropdown.setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-full! transition-colors text-[12px] font-semibold whitespace-nowrap"
        style={
          !isDefault && selectedStatus?.bg
            ? {
                backgroundColor: selectedStatus.bg,
                color: selectedStatus.text ?? 'var(--ink)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: selectedStatus.border ?? selectedStatus.bg,
              }
            : {
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--hairline)',
                color: 'var(--ink-muted)',
              }
        }
      >
        <span>{isDefault ? 'All statuses' : selectedStatus.name}</span>
        <IoChevronDown
          size={12}
          className={clsx('shrink-0 transition-transform', dropdown.open && 'rotate-180')}
        />
      </button>

      {isMounted &&
        dropdown.open &&
        createPortal(
          <div
            ref={dropdown.panelRef}
            className="rounded-2xl border border-card-border bg-neutral-0 shadow-[0_8px_24px_rgba(0,0,0,0.10)] overflow-hidden"
            style={dropdown.style}
          >
            {statusOptions.map((status) => {
              const isActive = status.key === activeStatus;
              return (
                <button
                  key={status.key}
                  type="button"
                  onClick={() => {
                    setActiveStatus?.(status.key);
                    dropdown.setOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-body-4 text-left transition-colors',
                    isActive && status.key !== 'all' ? 'font-medium' : 'hover:bg-card-hover'
                  )}
                >
                  {status.border && (
                    <span
                      className="inline-block size-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: status.border,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: status.border,
                      }}
                    />
                  )}
                  <span style={{ color: getDropdownStatusTextColor(status) }}>{status.name}</span>
                  {isActive && (
                    <span
                      className="ml-auto text-sm font-semibold"
                      style={{ color: getDropdownStatusTextColor(status) }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
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
              'relative flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 rounded-full! text-[12px] font-semibold transition-colors',
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

const ZoomToggle = ({
  zoomMode,
  setZoomMode,
}: {
  zoomMode: CalendarZoomMode;
  setZoomMode: React.Dispatch<React.SetStateAction<CalendarZoomMode>>;
}) => {
  const isZoomIn = zoomMode !== 'out';
  return (
    <div className="inline-flex shrink-0 items-center rounded-full border border-card-border bg-card-bg p-1">
      <button
        type="button"
        onClick={() => setZoomMode('in')}
        title="Zoom in timeline"
        aria-label="Zoom in timeline"
        className={`size-9 rounded-full! cursor-pointer inline-flex items-center justify-center transition-colors ${
          isZoomIn
            ? 'bg-neutral-0 text-text-primary border border-card-border'
            : 'text-text-secondary hover:bg-card-hover border border-transparent'
        }`}
      >
        <IoAddOutline size={18} />
      </button>
      <button
        type="button"
        onClick={() => setZoomMode('out')}
        title="Zoom out timeline"
        aria-label="Zoom out timeline"
        className={`size-9 rounded-full! cursor-pointer inline-flex items-center justify-center transition-colors ${
          isZoomIn
            ? 'text-text-secondary hover:bg-card-hover border border-transparent'
            : 'bg-neutral-0 text-text-primary border border-card-border'
        }`}
      >
        <IoRemoveOutline size={18} />
      </button>
    </div>
  );
};

type Headerprops = {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  zoomMode?: CalendarZoomMode;
  setZoomMode?: React.Dispatch<React.SetStateAction<CalendarZoomMode>>;
  activeCalendar?: string;
  setActiveCalendar?: React.Dispatch<React.SetStateAction<string>>;
  showAddButton?: boolean;
  onAddButtonClick?: () => void;
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
  zoomMode,
  setZoomMode,
  activeCalendar,
  setActiveCalendar,
  showAddButton = false,
  onAddButtonClick,
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

  return (
    <div className="sticky top-0 z-140 shrink-0 flex w-full items-center gap-4 border-b border-card-border bg-neutral-0 px-3 py-2">
      <div className="flex shrink-0 items-center gap-3">
        <GlassTooltip content="Select date" side="bottom">
          <div className="relative z-150">
            <Datepicker
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              placeholder="Select Date"
            />
          </div>
        </GlassTooltip>
        <div className="whitespace-nowrap text-body-3 font-medium text-text-primary">
          {getMonthYear(currentDate)}
        </div>
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
              <div className="h-8 w-px shrink-0 bg-card-border" aria-hidden="true" />
              <Primary
                text="New appointment"
                onClick={onAddButtonClick}
                icon={<IoAdd size={18} aria-hidden="true" />}
                className="h-12 w-fit shrink-0 justify-center gap-2 px-4 py-0 whitespace-nowrap hover:scale-100"
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
