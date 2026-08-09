import React from 'react';
import { createPortal } from 'react-dom';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import AppointmentPopover from '@/app/features/appointments/components/Calendar/common/AppointmentPopover';
import AppointmentContextMenu from '@/app/features/appointments/components/Calendar/common/AppointmentContextMenu';
import { MarkerContextMenuState } from '@/app/features/appointments/components/Calendar/common/useMarkerInteractions';

type SlotPortalsProps = {
  activeEvent: Appointment | null;
  activeRect: DOMRect | null;
  draggedAppointmentId?: string | null;
  invoicesByAppointmentId: Record<string, Invoice>;
  canEditAppointments: boolean;
  appointmentPopoverId: string;
  popoverDialogRef: React.RefObject<HTMLDialogElement | null>;
  popoverStyle: React.CSSProperties;
  registerAnchorEl: (el: HTMLElement | null) => () => void;
  contextMenu: MarkerContextMenuState | null;
  contextMenuRef: React.RefObject<HTMLDivElement | null>;
  contextMenuStyle: React.CSSProperties | null;
  handleViewAppointment: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  handleChangeRoomAppointment?: (appt: Appointment) => void;
  handleAcceptAppointment?: (appt: Appointment) => void;
  onPopoverClose: () => void;
  onContextMenuClose: () => void;
};

/**
 * The slot's floating layers - the appointment popover and the right-click
 * context menu - portaled to document.body so they escape the slot's overflow
 * clipping. The popover hides while a drag is in flight.
 */
const SlotPortals = ({
  activeEvent,
  activeRect,
  draggedAppointmentId,
  invoicesByAppointmentId,
  canEditAppointments,
  appointmentPopoverId,
  popoverDialogRef,
  popoverStyle,
  registerAnchorEl,
  contextMenu,
  contextMenuRef,
  contextMenuStyle,
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeRoomAppointment,
  handleAcceptAppointment,
  onPopoverClose,
  onContextMenuClose,
}: SlotPortalsProps) => {
  const canPortal = typeof document !== 'undefined';

  return (
    <>
      {canPortal &&
        !draggedAppointmentId &&
        activeEvent &&
        activeRect &&
        createPortal(
          <AppointmentPopover
            appointment={activeEvent}
            invoicesByAppointmentId={invoicesByAppointmentId}
            canEditAppointments={canEditAppointments}
            popoverId={appointmentPopoverId}
            popoverDialogRef={popoverDialogRef}
            popoverStyle={popoverStyle}
            handleRescheduleAppointment={handleRescheduleAppointment}
            handleChangeRoomAppointment={handleChangeRoomAppointment}
            handleAcceptAppointment={handleAcceptAppointment}
            onClose={onPopoverClose}
            registerAnchorEl={registerAnchorEl}
          />,
          document.body
        )}
      {canPortal &&
        contextMenu &&
        contextMenuStyle &&
        createPortal(
          <AppointmentContextMenu
            appointment={contextMenu.appointment}
            canEditAppointments={canEditAppointments}
            menuRef={contextMenuRef}
            menuStyle={contextMenuStyle}
            handleViewAppointment={handleViewAppointment}
            handleRescheduleAppointment={handleRescheduleAppointment}
            onClose={onContextMenuClose}
          />,
          document.body
        )}
    </>
  );
};

export default SlotPortals;
