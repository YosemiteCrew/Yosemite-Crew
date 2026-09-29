import React from 'react';
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { toStatusLabel } from '@/app/lib/appointments';
import { getMenuItemClassName } from '@/app/features/appointments/components/Calendar/common/appointmentContextMenuHelpers';

type StatusSubmenuProps = {
  submenuRef: React.RefObject<HTMLDivElement | null>;
  submenuStyle: React.CSSProperties;
  statusOptions: AppointmentStatus[];
  savingKey: string | null;
  cancelSeriesOnly?: boolean;
  onSelectStatus: (status: AppointmentStatus, scope?: 'this' | 'following') => void;
};

const StatusSubmenu = ({
  submenuRef,
  submenuStyle,
  statusOptions,
  savingKey,
  cancelSeriesOnly = false,
  onSelectStatus,
}: StatusSubmenuProps) => (
  <div
    ref={submenuRef}
    role="menu"
    aria-label={cancelSeriesOnly ? 'Cancel appointment series' : 'Change appointment status'}
    data-context-menu="true"
    className="yc-glass-overlay fixed z-[1002] overflow-hidden rounded-[22px] px-1.5 py-2"
    style={submenuStyle}
  >
    <div className="flex flex-col gap-0.5">
      {statusOptions.reduce<React.ReactNode[]>((items, status) => {
        if (cancelSeriesOnly && status === 'CANCELLED') return items;
        if (items.length > 0) {
          items.push(
            <div
              key={`separator-${status}`}
              className="mx-1 border-t border-[var(--hairline)]"
              aria-hidden="true"
            />
          );
        }
        items.push(
          <button
            key={status}
            type="button"
            role="menuitem"
            className={getMenuItemClassName(false)}
            onClick={() => onSelectStatus(status)}
            disabled={savingKey === `status-${status}`}
          >
            <span className="truncate">{toStatusLabel(status)}</span>
            {savingKey === `status-${status}` ? (
              <span className="shrink-0 text-[8px]">Saving</span>
            ) : null}
          </button>
        );
        return items;
      }, [])}
      {cancelSeriesOnly ? (
        <>
          {statusOptions.length > 0 ? (
            <div className="mx-1 border-t border-[var(--hairline)]" aria-hidden="true" />
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={getMenuItemClassName(true)}
            onClick={() => onSelectStatus('CANCELLED', 'this')}
            disabled={savingKey === 'cancel-this'}
          >
            <span className="truncate">Cancel this appointment</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={getMenuItemClassName(true)}
            onClick={() => onSelectStatus('CANCELLED', 'following')}
            disabled={savingKey === 'cancel-following'}
          >
            <span className="truncate">Cancel this and following</span>
          </button>
        </>
      ) : null}
    </div>
  </div>
);

export default StatusSubmenu;
