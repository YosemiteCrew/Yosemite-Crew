import React from 'react';
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { toStatusLabel } from '@/app/lib/appointments';
import { getMenuItemClassName } from '@/app/features/appointments/components/Calendar/common/appointmentContextMenuHelpers';

type StatusSubmenuProps = {
  submenuRef: React.RefObject<HTMLDivElement | null>;
  submenuStyle: React.CSSProperties;
  statusOptions: AppointmentStatus[];
  savingKey: string | null;
  onSelectStatus: (status: AppointmentStatus) => void;
};

const StatusSubmenu = ({
  submenuRef,
  submenuStyle,
  statusOptions,
  savingKey,
  onSelectStatus,
}: StatusSubmenuProps) => (
  <div
    ref={submenuRef}
    role="menu"
    aria-label="Change appointment status"
    data-context-menu="true"
    className="yc-glass-overlay fixed z-[1002] overflow-hidden rounded-[22px] px-1.5 py-2"
    style={submenuStyle}
  >
    <div className="flex flex-col gap-0.5">
      {statusOptions.map((status, index) => (
        <React.Fragment key={status}>
          {index > 0 ? <div className="mx-1 border-t border-white/30" aria-hidden="true" /> : null}
          <button
            type="button"
            role="menuitem"
            className={getMenuItemClassName(false)}
            onClick={() => onSelectStatus(status)}
            disabled={savingKey === `status-${status}`}
          >
            <span className="truncate">{toStatusLabel(status)}</span>
            {savingKey === `status-${status}` ? (
              <span className="shrink-0 text-[8px] opacity-60">Saving</span>
            ) : null}
          </button>
        </React.Fragment>
      ))}
    </div>
  </div>
);

export default StatusSubmenu;
