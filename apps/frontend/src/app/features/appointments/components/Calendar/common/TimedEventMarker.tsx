import React from 'react';
import Image from 'next/image';
import { Appointment } from '@yosemite-crew/types';
import { getStatusStyle } from '@/app/config/statusConfig';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { EVENT_HORIZONTAL_GAP_PX } from '@/app/features/appointments/components/Calendar/helpers';
import { LaidOutEvent } from '@/app/features/appointments/types/calendar';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import {
  getCompanionDisplayName,
  setCustomDragGhost,
} from '@/app/features/appointments/components/Calendar/common/dayCalendarHelpers';

type TimedEventMarkerProps = {
  ev: LaidOutEvent;
  itemKey: string;
  yScale: number;
  zoomMode: CalendarZoomMode;
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

const TimedEventMarker = ({
  ev,
  itemKey,
  yScale,
  zoomMode,
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
}: TimedEventMarkerProps) => {
  const widthPercent = 100 / ev.columnsCount;
  const leftPercent = widthPercent * ev.columnIndex;
  const horizontalGapPx = EVENT_HORIZONTAL_GAP_PX;
  const verticalGapPx = 0;
  const isZoomOut = zoomMode === 'out';
  const statusStyle = getStatusStyle(ev.status);
  const serviceName = ev.appointmentType?.name?.trim() ?? '';
  const concern = ev.concern?.trim() ?? '';
  const subtitle = [serviceName, concern].filter(Boolean).join(' • ');
  const companionDisplayName = getCompanionDisplayName(ev);
  const markerTitle = subtitle ? `${companionDisplayName} • ${subtitle}` : companionDisplayName;
  const draggable = !!canDragAppointment?.(ev);

  return (
    <div
      className={`absolute scrollbar-hidden ${isZoomOut ? 'rounded-md! p-0 bg-transparent' : 'rounded-xl! px-2 py-1.5 overflow-hidden'}`}
      style={{
        top: ev.topPx * yScale,
        height: Math.max(
          ev.heightPx * yScale - (isZoomOut ? 0 : verticalGapPx),
          isZoomOut ? 3 : 40
        ),
        left: `calc(${leftPercent}% + ${horizontalGapPx}px)`,
        width: `calc(${widthPercent}% - ${horizontalGapPx * 2}px)`,
        ...(isZoomOut
          ? {}
          : {
              backgroundColor: statusStyle.backgroundColor,
              color: statusStyle.color,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: statusStyle.borderColor,
            }),
      }}
    >
      {isZoomOut && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0.5 right-0.5 rounded-sm"
          style={{
            backgroundColor: statusStyle.backgroundColor,
          }}
        />
      )}
      <button
        type="button"
        className={`min-w-0 ${
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        } ${isZoomOut ? 'absolute inset-x-0 -inset-y-2 z-20' : 'size-full flex items-center gap-2'}`}
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
        {!isZoomOut && (
          <>
            <div className="min-w-0 flex-1 self-center">
              <div className="w-full flex flex-col items-center justify-center text-center gap-0.5">
                <div className="truncate w-full text-caption-1 font-bold leading-[1.2]">
                  {companionDisplayName}
                </div>
                {subtitle && (
                  <div className="font-satoshi text-[11px] font-normal leading-[1.2] tracking-[-0.22px] w-full truncate">
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-none self-center">
              <Image
                src={getSafeImageUrl(
                  getAppointmentCompanionPhotoUrl(ev.companion),
                  (ev.companion ?? ev.patient).species.toLowerCase() as ImageType
                )}
                height={26}
                width={26}
                priority
                className="rounded-full border border-white/60 object-cover"
                style={{ width: 26, height: 26 }}
                alt=""
              />
            </div>
          </>
        )}
        {isZoomOut && <span className="sr-only">{markerTitle}</span>}
      </button>
    </div>
  );
};

export default TimedEventMarker;
