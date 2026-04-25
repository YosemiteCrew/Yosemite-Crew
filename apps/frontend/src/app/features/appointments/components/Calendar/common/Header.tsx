import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getMonthYear } from '@/app/features/appointments/components/Calendar/helpers';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { FiZoomIn, FiZoomOut } from 'react-icons/fi';
import Datepicker from '@/app/ui/inputs/Datepicker';
import Dropdown from '@/app/ui/inputs/Dropdown';
import { IoAdd, IoWarning } from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { FaCaretDown } from 'react-icons/fa6';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { Primary } from '@/app/ui/primitives/Buttons';

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
  if (filterKey === 'emergencies') return 'text-danger-500!';
  return 'bg-blue-light text-blue-text!';
};

const getFilterBorderColor = (filterKey: string, activeFilter: string): string => {
  if (filterKey !== activeFilter) return 'var(--color-card-border)';
  if (filterKey === 'emergencies') return 'var(--color-danger-500)';
  return 'var(--color-text-brand)';
};

const getEmergencyPillStyle = (isActive: boolean): React.CSSProperties => ({
  backgroundColor: isActive ? 'var(--color-semantic-error-100)' : 'var(--color-neutral-0)',
  borderColor: isActive ? 'var(--color-semantic-error-500)' : 'var(--color-neutral-500)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderRadius: '16px',
  boxShadow: '0 1px 10px 0 rgba(169, 163, 158, 0.10)',
  color: isActive ? 'var(--color-semantic-error-700)' : 'var(--color-neutral-700)',
});

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
  const isZoomIn = zoomMode !== 'out';
  const isZoomOut = !isZoomIn;
  const showCalendarTypeSelector = !!activeCalendar && !!setActiveCalendar;

  const [statusOpen, setStatusOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [isMounted, setIsMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedStatus = statusOptions?.find((s) => s.key === activeStatus) ?? statusOptions?.[0];
  const isEmergencyFilterActive = activeFilter === 'emergencies';
  const handleFilterToggle = (filterKey: string) => {
    if (!setActiveFilter) return;
    setActiveFilter(activeFilter === filterKey ? 'all' : filterKey);
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const positionPanel = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, 180),
      zIndex: 9999,
    });
  }, []);

  useLayoutEffect(() => {
    if (statusOpen) positionPanel();
  }, [statusOpen, positionPanel]);

  useEffect(() => {
    if (!statusOpen) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return;
      setStatusOpen(false);
    };
    const handleScroll = () => setStatusOpen(false);
    document.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [statusOpen]);

  const filterButtons = filterOptions?.map((filter) => {
    const isEmergencyFilter = filter.key === 'emergencies';
    const isActiveFilter = filter.key === activeFilter;
    const emergencyTextColor = isEmergencyFilterActive
      ? 'var(--color-semantic-error-700)'
      : 'var(--color-neutral-700)';
    const emergencyIconColor = emergencyTextColor;
    const emergencyPillStyle = isEmergencyFilter
      ? getEmergencyPillStyle(isActiveFilter)
      : {
          borderWidth: isActiveFilter && isEmergencyFilter ? '2px' : '1px',
          borderStyle: 'solid',
          borderColor: getFilterBorderColor(filter.key, activeFilter ?? ''),
          backgroundColor:
            isActiveFilter && isEmergencyFilter ? 'var(--color-danger-soft)' : undefined,
        };

    return (
      <button
        key={filter.key}
        type="button"
        onClick={() => handleFilterToggle(filter.key)}
        className={clsx(
          'relative flex h-12 min-w-32 items-center justify-center gap-2 whitespace-nowrap text-body-4 px-3 rounded-2xl! transition-all duration-300',
          getFilterClassName(filter.key, activeFilter ?? '')
        )}
        style={emergencyPillStyle}
      >
        {isEmergencyFilter && (
          <IoWarning size={18} aria-hidden="true" className="shrink-0" color={emergencyIconColor} />
        )}
        <span>{filter.name}</span>
        {isEmergencyFilter && hasEmergency && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: 'var(--color-semantic-error-700)',
              outline: '2px solid white',
            }}
          />
        )}
      </button>
    );
  });

  return (
    <div className="sticky top-0 z-[140] shrink-0 overflow-visible flex w-full items-center justify-between gap-4 border-b border-grey-light bg-white px-3 py-2">
      <div className="flex min-w-0 shrink-0 items-center gap-3">
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

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        {statusOptions && statusOptions.length > 0 && (
          <>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setStatusOpen((v) => !v)}
              className="h-12 flex items-center gap-2 px-3 rounded-2xl! transition-all duration-300 text-body-4 justify-between"
              style={
                selectedStatus?.bg
                  ? {
                      backgroundColor: selectedStatus.bg,
                      color: selectedStatus.text ?? 'var(--color-black-pure)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: selectedStatus.border ?? selectedStatus.bg,
                    }
                  : {
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'var(--color-card-border)',
                      color: 'var(--color-text-tertiary)',
                    }
              }
            >
              <span>{selectedStatus?.name ?? 'Status'}</span>
              <FaCaretDown
                size={14}
                className={clsx('shrink-0 transition-transform', statusOpen && 'rotate-180')}
              />
            </button>

            {isMounted &&
              statusOpen &&
              createPortal(
                <div
                  ref={panelRef}
                  className="rounded-2xl border border-card-border bg-white shadow-[0_8px_24px_rgba(0,0,0,0.10)] overflow-hidden"
                  style={dropdownStyle}
                >
                  {statusOptions.map((status) => {
                    const isActive = status.key === activeStatus;
                    return (
                      <button
                        key={status.key}
                        type="button"
                        onClick={() => {
                          setActiveStatus?.(status.key);
                          setStatusOpen(false);
                        }}
                        className={clsx(
                          'w-full flex items-center gap-2.5 px-3 py-2.5 text-body-4 text-left transition-colors',
                          isActive ? 'font-medium' : 'hover:bg-card-hover'
                        )}
                      >
                        {status.border && (
                          <span
                            className="inline-block h-3 w-3 rounded-full shrink-0"
                            style={{
                              backgroundColor: status.border,
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: status.border,
                            }}
                          />
                        )}
                        <span style={{ color: getDropdownStatusTextColor(status) }}>
                          {status.name}
                        </span>
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
        )}

        {filterButtons}

        {showAddButton && (
          <>
            <div className="h-8 w-px shrink-0 bg-card-border" aria-hidden="true" />
            <Primary
              text="Add Appointment"
              onClick={onAddButtonClick}
              icon={<IoAdd size={18} aria-hidden="true" />}
              className="gap-2 px-4 whitespace-nowrap hover:scale-100"
            />
          </>
        )}

        {showCalendarTypeSelector && (
          <div className="relative z-150">
            <Dropdown
              options={[
                { key: 'day', label: 'Day' },
                { key: 'week', label: 'Week' },
                { key: 'team', label: 'Team' },
              ]}
              placeholder="View"
              defaultOption={activeCalendar}
              onSelect={(option) => setActiveCalendar(option.key)}
            />
          </div>
        )}

        {zoomMode && setZoomMode && (
          <div className="inline-flex items-center rounded-full border border-card-border bg-card-bg p-1">
            <button
              type="button"
              onClick={() => setZoomMode('in')}
              title="Zoom in timeline"
              className={`h-9 w-9 rounded-full! cursor-pointer inline-flex items-center justify-center transition-colors ${
                isZoomIn
                  ? 'bg-white text-text-primary border border-card-border'
                  : 'text-text-secondary hover:bg-card-hover border border-transparent'
              }`}
            >
              <FiZoomIn size={18} />
            </button>
            <button
              type="button"
              onClick={() => setZoomMode('out')}
              title="Zoom out timeline"
              className={`h-9 w-9 rounded-full! cursor-pointer inline-flex items-center justify-center transition-colors ${
                isZoomOut
                  ? 'bg-white text-text-primary border border-card-border'
                  : 'text-text-secondary hover:bg-card-hover border border-transparent'
              }`}
            >
              <FiZoomOut size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;
