import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCaretDown } from 'react-icons/fa';
import type { Appointment } from '@yosemite-crew/types';
import {
  canShowStatusChangeAction,
  getAllowedAppointmentStatusTransitions,
  isRequestedLikeStatus,
  toStatusLabel,
} from '@/app/lib/appointments';
import { getStatusStyle } from '@/app/config/statusConfig';
import { changeAppointmentStatus } from '@/app/features/appointments/services/appointmentService';
import type { AppointmentStatus } from '@/app/features/appointments/types/appointments';

type AppointmentStatusPillProps = {
  appointment: Appointment;
  /** When false the pill renders read-only even if a transition is allowed. */
  canEdit?: boolean;
  /** Fired after a successful status change (e.g. to close a popover). */
  onChanged?: () => void;
  /** Keeps the open menu anchored to a scroll/hover container. */
  registerAnchorEl?: (el: HTMLElement | null) => () => void;
};

const basePillStyle = (style: ReturnType<typeof getStatusStyle>): React.CSSProperties => ({
  backgroundColor: style.backgroundColor,
  color: style.color,
  fontFamily: 'var(--font-satoshi), sans-serif',
  fontSize: '14px',
  fontWeight: 500,
  lineHeight: '120%',
  letterSpacing: '-0.28px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: style.borderColor,
});

/**
 * Shared appointment status pill. Renders a static badge, or — when the status
 * can change and editing is allowed — a dropdown trigger that lists the allowed
 * transitions and persists the chosen status. Single source of truth for status
 * display + change across the calendar popover and the appointment workspace.
 */
const AppointmentStatusPill = ({
  appointment,
  canEdit = true,
  onChanged,
  registerAnchorEl,
}: AppointmentStatusPillProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const statusStyle = getStatusStyle(appointment.status);
  const allowedTransitions = getAllowedAppointmentStatusTransitions(appointment.status);
  const canChange =
    canEdit &&
    !isRequestedLikeStatus(appointment.status) &&
    canShowStatusChangeAction(appointment.status) &&
    allowedTransitions.length > 0;

  const triggerStyle = useMemo<React.CSSProperties>(
    () => ({ ...basePillStyle(statusStyle), opacity: saving ? 0.6 : 1 }),
    [statusStyle, saving]
  );

  const positionMenu = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: 'max-content',
      zIndex: 10000,
    });
  };

  useLayoutEffect(() => {
    if (open) positionMenu();
  }, [open]);

  useEffect(() => {
    if (!open || !registerAnchorEl) return;
    return registerAnchorEl(panelRef.current);
  }, [open, registerAnchorEl]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const handleStatusChange = async (nextStatus: AppointmentStatus) => {
    try {
      setSaving(true);
      setError(null);
      await changeAppointmentStatus(appointment, nextStatus);
      setOpen(false);
      onChanged?.();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Failed to update status.';
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  if (!canChange) {
    return (
      <span
        className="flex h-8 min-w-25 items-center justify-center rounded-2xl! px-3 py-2 font-satoshi text-[14px] font-medium leading-[120%] tracking-[-0.0175rem] whitespace-nowrap shadow-[0_1px_10px_0_rgba(169,163,158,0.10)]"
        style={basePillStyle(statusStyle)}
      >
        {toStatusLabel(appointment.status)}
      </span>
    );
  }

  return (
    <div className="relative flex flex-col items-end gap-1.5">
      <button
        ref={triggerRef}
        type="button"
        data-popover-panel="true"
        disabled={saving}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="flex h-8 min-w-25 items-center justify-between gap-1.5 rounded-2xl! px-3 py-2 font-satoshi text-[14px] font-medium leading-[120%] tracking-[-0.0175rem] whitespace-nowrap shadow-[0_1px_10px_0_rgba(169,163,158,0.10)]"
        style={triggerStyle}
      >
        <span>{saving ? 'Saving…' : toStatusLabel(appointment.status)}</span>
        <FaCaretDown
          size={10}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {error && (
        <div
          role="alert"
          className="absolute right-0 top-full mt-1 z-10 rounded-lg border border-card-border bg-white px-2 py-1 text-[10px] text-text-error shadow-sm whitespace-nowrap"
        >
          {error}
        </div>
      )}

      {open &&
        createPortal(
          <div
            id={menuId}
            ref={panelRef}
            data-popover-panel="true"
            role="menu"
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-2xl! bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden whitespace-nowrap"
            style={{
              ...menuStyle,
              minWidth: 120,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--color-card-border)',
            }}
          >
            {allowedTransitions.map((nextStatus) => {
              const s = getStatusStyle(nextStatus);
              return (
                <button
                  key={nextStatus}
                  type="button"
                  role="menuitem"
                  disabled={saving}
                  onClick={() => void handleStatusChange(nextStatus)}
                  className="flex h-8 w-full items-center gap-1 rounded-none! px-3 py-2 text-left transition-colors hover:bg-card-hover"
                  style={{
                    fontFamily: 'var(--font-satoshi), sans-serif',
                    fontSize: '14px',
                    fontWeight: 500,
                    lineHeight: '120%',
                    letterSpacing: '-0.28px',
                  }}
                >
                  <span
                    className="inline-block size-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: s.borderColor,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: s.borderColor,
                    }}
                  />
                  <span style={{ color: s.color }}>{toStatusLabel(nextStatus)}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};

export default AppointmentStatusPill;
