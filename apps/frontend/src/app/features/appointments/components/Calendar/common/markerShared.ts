import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { setCustomDragGhost } from '@/app/features/appointments/components/Calendar/common/slotHelpers';

/** Interaction props shared by every calendar appointment marker variant. */
export type MarkerInteractionProps = {
  itemKey: string;
  activePopoverKey: string | null;
  appointmentPopoverId: string;
  draggedAppointmentId?: string | null;
  canDragAppointment?: (appointment: Appointment) => boolean;
  onMarkerClick: (event: React.MouseEvent<HTMLButtonElement>, key: string) => void;
  onMarkerDoubleClick: (appointment: Appointment) => void;
  onMarkerContextMenu: (
    event: React.MouseEvent<HTMLButtonElement>,
    appointment: Appointment
  ) => void;
  onAppointmentDragStart?: (appointment: Appointment) => void;
  onAppointmentDragEnd?: () => void;
  onDropPreviewClear: () => void;
};

/**
 * The button props every marker variant applies identically: popover ARIA wiring,
 * click/double-click/context-menu dispatch, drag lifecycle (custom ghost, grabbing
 * cursor, drop-preview clear), and the dragged-state opacity.
 */
export const getMarkerButtonProps = (
  ev: Appointment,
  {
    itemKey,
    activePopoverKey,
    appointmentPopoverId,
    draggedAppointmentId,
    canDragAppointment,
    onMarkerClick,
    onMarkerDoubleClick,
    onMarkerContextMenu,
    onAppointmentDragStart,
    onAppointmentDragEnd,
    onDropPreviewClear,
  }: MarkerInteractionProps,
  markerTitle: string
) => ({
  'aria-haspopup': 'dialog' as const,
  'aria-expanded': activePopoverKey === itemKey,
  'aria-controls': appointmentPopoverId,
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => onMarkerClick(event, itemKey),
  onDoubleClick: () => onMarkerDoubleClick(ev),
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => onMarkerContextMenu(event, ev),
  draggable: !!canDragAppointment?.(ev),
  title: markerTitle,
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', ev.id ?? itemKey);
    setCustomDragGhost(event, ev);
    document.body.style.cursor = 'grabbing';
    onAppointmentDragStart?.(ev);
  },
  onDragEnd: () => {
    onDropPreviewClear();
    document.body.style.cursor = '';
    onAppointmentDragEnd?.();
  },
  style: {
    opacity: draggedAppointmentId === ev.id ? 0.55 : 1,
  },
});
