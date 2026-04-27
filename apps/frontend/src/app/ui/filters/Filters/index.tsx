'use client';
import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FilterOption, StatusOption } from '@/app/features/companions/pages/Companions/types';
import { FaCaretDown } from 'react-icons/fa6';
import clsx from 'clsx';
import { Primary } from '@/app/ui/primitives/Buttons';
import { IoAdd, IoWarning } from 'react-icons/io5';
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

type FiltersProps = {
  filterOptions?: FilterOption[];
  statusOptions?: StatusOption[];
  activeFilter?: string;
  setActiveFilter?: (v: string) => void;
  activeStatus?: string;
  setActiveStatus?: (v: string) => void;
  hasEmergency?: boolean;
  showAddButton?: boolean;
  onAddButtonClick?: () => void;
  addButtonText?: string;
  className?: string;
};

const Filters = ({
  filterOptions,
  statusOptions,
  activeFilter,
  setActiveFilter,
  activeStatus,
  setActiveStatus,
  hasEmergency = false,
  showAddButton = false,
  onAddButtonClick,
  addButtonText = 'Add Appointment',
  className,
}: FiltersProps) => {
  const [open, setOpen] = useState(false);
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
    if (open) positionPanel();
  }, [open, positionPanel]);

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

  return (
    <div className={clsx('w-full flex items-center justify-between flex-wrap gap-2', className)}>
      {/* Left: filter pills (All / Emergencies) */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterOptions?.map((filter) => {
          const isEmergency = filter.key === 'emergencies';
          const isActiveEmergency = isEmergency && filter.key === activeFilter;
          const emergencyColor = isActiveEmergency
            ? 'var(--color-semantic-error-700)'
            : 'var(--color-neutral-700)';
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => handleFilterToggle(filter.key)}
              className={clsx(
                'relative inline-flex h-12 min-w-20 items-center justify-center text-body-4 px-3 rounded-2xl! border! transition-all duration-300',
                isEmergency ? 'gap-2' : getFilterClassName(filter.key, activeFilter ?? '')
              )}
              style={
                isEmergency
                  ? getEmergencyPillStyle(isActiveEmergency)
                  : {
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: getFilterBorderColor(filter.key, activeFilter ?? ''),
                    }
              }
            >
              {isEmergency && (
                <IoWarning
                  size={18}
                  aria-hidden="true"
                  className="shrink-0"
                  color={emergencyColor}
                />
              )}
              <span>{filter.name}</span>
              {isEmergency && hasEmergency && (
                <span
                  aria-label="Emergency appointments present"
                  className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--color-semantic-error-700)',
                    outline: '2px solid white',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Right: status dropdown + add */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {statusOptions && statusOptions.length > 0 && (
          <>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-12 items-center gap-2 px-3 rounded-2xl! transition-all duration-300 text-body-4 justify-between"
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
                className={clsx('shrink-0 transition-transform', open && 'rotate-180')}
              />
            </button>

            {isMounted &&
              open &&
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
                          setOpen(false);
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
        {showAddButton && (
          <Primary
            text={addButtonText}
            onClick={onAddButtonClick}
            icon={<IoAdd size={18} aria-hidden="true" />}
            className="h-12 w-fit justify-center gap-2 px-4 py-0 whitespace-nowrap hover:scale-100"
          />
        )}
      </div>
    </div>
  );
};

export default Filters;
