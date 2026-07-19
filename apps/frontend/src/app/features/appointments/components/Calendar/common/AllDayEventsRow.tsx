import React from 'react';
import Image from 'next/image';
import { Appointment } from '@yosemite-crew/types';
import { getStatusStyle } from '@/app/config/statusConfig';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import {
  getAllDayAppointmentAriaLabel,
  getCompanionDisplayName,
  getEventKey,
} from '@/app/features/appointments/components/Calendar/common/dayCalendarHelpers';

type AllDayEventsRowProps = {
  allDayEvents: Appointment[];
  activePopoverKey: string | null;
  appointmentPopoverId: string;
  onMarkerClick: (event: React.MouseEvent<HTMLButtonElement>, key: string) => void;
  onMarkerDoubleClick: (appointment: Appointment) => void;
  onMarkerContextMenu: (
    event: React.MouseEvent<HTMLButtonElement>,
    appointment: Appointment
  ) => void;
};

const AllDayEventsRow = ({
  allDayEvents,
  activePopoverKey,
  appointmentPopoverId,
  onMarkerClick,
  onMarkerDoubleClick,
  onMarkerContextMenu,
}: AllDayEventsRowProps) => (
  <div className="p-2 border-b border-grey-light bg-neutral-100 shrink-0">
    <div className="text-xs font-satoshi text-grey-text mb-1">All-day</div>
    <div className="flex flex-wrap gap-2">
      {allDayEvents.map((ev, idx) => {
        const itemKey = getEventKey(ev, idx, 'all-day');
        return (
          <button
            key={itemKey}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={activePopoverKey === itemKey}
            aria-controls={appointmentPopoverId}
            aria-label={getAllDayAppointmentAriaLabel(ev)}
            onClick={(event) => onMarkerClick(event, itemKey)}
            onDoubleClick={() => onMarkerDoubleClick(ev)}
            onContextMenu={(event) => onMarkerContextMenu(event, ev)}
            className="flex items-center gap-2 rounded-full! px-3 py-1 text-xs font-satoshi"
            style={getStatusStyle(ev.status)}
          >
            <Image
              src={getSafeImageUrl(
                getAppointmentCompanionPhotoUrl(ev.companion),
                (ev.companion ?? ev.patient).species.toLowerCase() as ImageType
              )}
              height={20}
              width={20}
              priority
              className="size-5 rounded-full object-cover"
              alt={''}
            />
            <span className="font-medium truncate max-w-40">{getCompanionDisplayName(ev)}</span>
            <span className="opacity-70 truncate max-w-30">{ev.concern || ''}</span>
          </button>
        );
      })}
    </div>
  </div>
);

export default AllDayEventsRow;
