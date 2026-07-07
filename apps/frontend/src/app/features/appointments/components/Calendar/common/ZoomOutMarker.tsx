import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { getStatusStyle } from '@/app/config/statusConfig';
import {
  getCompanionDisplayName,
  setCustomDragGhost,
} from '@/app/features/appointments/components/Calendar/common/slotHelpers';

type ZoomOutMarkerProps = {
  ev: Appointment;
  itemKey: string;
  marginTopPx: number;
  blockHeightPx: number;
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

const ZoomOutMarker = ({
  ev,
  itemKey,
  marginTopPx,
  blockHeightPx,
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
}: ZoomOutMarkerProps) => {
  const statusStyle = getStatusStyle(ev.status);
  const serviceName = ev.appointmentType?.name?.trim() ?? '';
  const concern = ev.concern?.trim() ?? '';
  const subtitle = [serviceName, concern].filter(Boolean).join(' • ');
  const companionDisplayName = getCompanionDisplayName(ev);
  const markerTitle = subtitle ? `${companionDisplayName} • ${subtitle}` : companionDisplayName;
  const draggable = !!canDragAppointment?.(ev);

  return (
    <div
      className="relative z-20 rounded-md p-0 border-0 bg-transparent"
      style={{
        marginTop: marginTopPx,
        minHeight: blockHeightPx,
        height: blockHeightPx,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0.5 right-0.5 rounded-sm z-30"
        style={{
          backgroundColor: statusStyle.backgroundColor,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: statusStyle.borderColor,
        }}
      />
      <button
        type="button"
        className={`min-w-0 absolute inset-x-0 -inset-y-2 z-20 ${
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        }`}
        aria-haspopup="dialog"
        aria-expanded={activePopoverKey === itemKey}
        aria-controls={appointmentPopoverId}
        onClick={(event) => onMarkerClick(event, itemKey)}
        onDoubleClick={() => onMarkerDoubleClick(ev)}
        onContextMenu={(event) => onMarkerContextMenu(event, ev)}
        draggable={draggable}
        title={markerTitle}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', ev.id ?? itemKey);
          setCustomDragGhost(event, ev);
          document.body.style.cursor = 'grabbing';
          onAppointmentDragStart?.(ev);
        }}
        onDragEnd={() => {
          onDropPreviewClear();
          document.body.style.cursor = '';
          onAppointmentDragEnd?.();
        }}
        style={{
          opacity: draggedAppointmentId === ev.id ? 0.55 : 1,
        }}
      >
        <span className="sr-only">{markerTitle}</span>
      </button>
    </div>
  );
};

export default ZoomOutMarker;
