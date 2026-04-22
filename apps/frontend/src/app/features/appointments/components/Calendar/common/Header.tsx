import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getMonthYear } from '@/app/features/appointments/components/Calendar/helpers';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { FiZoomIn, FiZoomOut } from 'react-icons/fi';
import Datepicker from '@/app/ui/inputs/Datepicker';
import Dropdown from '@/app/ui/inputs/Dropdown';
import { IoAdd } from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { FaCaretDown } from 'react-icons/fa6';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { Primary } from '@/app/ui/primitives/Buttons';

type FilterOption = { key: string; name: string };
type StatusOption = { key: string; name: string; bg?: string; text?: string; border?: string };

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

  return (
    <div className="relative z-[140] overflow-visible flex w-full items-center justify-between gap-2 px-3 py-2 border-b border-grey-light">
      {/* Left: month + filter pills */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-heading-2 text-text-primary pr-3">{getMonthYear(currentDate)}</div>
        {filterOptions?.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => handleFilterToggle(filter.key)}
            className={clsx(
              'relative min-w-20 text-body-4 px-3 py-1.25 rounded-2xl! transition-all duration-300',
              filter.key === activeFilter
                ? filter.key === 'emergencies'
                  ? 'text-[#EF4444]! bg-[#FEE7E7]!'
                  : 'bg-blue-light text-blue-text!'
                : 'text-text-tertiary hover:bg-card-hover!'
            )}
            style={{
              borderWidth:
                filter.key === activeFilter && filter.key === 'emergencies' ? '2px' : '1px',
              borderStyle: 'solid',
              borderColor:
                filter.key === activeFilter
                  ? filter.key === 'emergencies'
                    ? '#EF4444'
                    : 'var(--color-text-brand)'
                  : 'var(--color-card-border)',
            }}
          >
            {filter.name}
            {filter.key === 'emergencies' && hasEmergency && (
              <span
                aria-label="Emergency appointments present"
                className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border"
                style={{
                  backgroundColor: '#EF4444',
                  borderColor: '#EF4444',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Right: status dropdown + date picker + view selector + zoom + add */}
      <div className="flex items-center gap-2">
        {showAddButton && (
          <Primary
            text="Add Appointment"
            onClick={onAddButtonClick}
            icon={<IoAdd size={18} aria-hidden="true" />}
            className="gap-2 px-4 py-3 whitespace-nowrap hover:scale-100"
          />
        )}

        {statusOptions && statusOptions.length > 0 && (
          <>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setStatusOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.25 rounded-2xl! transition-all duration-300 text-body-4 justify-between"
              style={
                selectedStatus?.bg
                  ? {
                      backgroundColor: selectedStatus.bg,
                      color: selectedStatus.text ?? '#000',
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
                        <span style={{ color: status.text ?? 'var(--color-text-primary)' }}>
                          {status.name}
                        </span>
                        {isActive && (
                          <span
                            className="ml-auto text-sm font-semibold"
                            style={{ color: status.text }}
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

        <GlassTooltip content="Select date" side="bottom">
          <div className="relative z-150 scale-[0.94] origin-right">
            <Datepicker
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              placeholder="Select Date"
            />
          </div>
        </GlassTooltip>

        {showCalendarTypeSelector && (
          <div className="relative z-150 scale-[0.94] origin-right">
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
