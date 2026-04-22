'use client';
import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FilterOption, StatusOption } from '@/app/features/companions/pages/Companions/types';
import { FaCaretDown } from 'react-icons/fa6';
import clsx from 'clsx';
import { Primary } from '@/app/ui/primitives/Buttons';
import { IoAdd } from 'react-icons/io5';

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
    <div className="w-full flex items-center justify-between flex-wrap gap-2">
      {/* Left: filter pills (All / Emergencies) */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterOptions?.map((filter) => (
          <button
            key={filter.key}
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

      {/* Right: status dropdown + add */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {statusOptions && statusOptions.length > 0 && (
          <>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
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
        {showAddButton && (
          <Primary
            text="Add Appointment"
            onClick={onAddButtonClick}
            icon={<IoAdd size={18} aria-hidden="true" />}
            className="gap-2 px-4 py-3 whitespace-nowrap hover:scale-100"
          />
        )}
      </div>
    </div>
  );
};

export default Filters;
