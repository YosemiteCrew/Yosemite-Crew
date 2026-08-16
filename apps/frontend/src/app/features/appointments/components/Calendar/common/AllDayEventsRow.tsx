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
  // All-week tray from the frame: --inset surface, 10px/700/0.08em all-caps label.
  <div
    className="shrink-0 border-b px-[10px] py-2"
    style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--inset)' }}
  >
    <div
      className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] font-satoshi"
      style={{ color: 'var(--ink-faint)' }}
    >
      All-day
    </div>
    <div className="flex flex-wrap gap-[7px]">
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
            className="flex items-center gap-1.5 rounded-full! px-[10px] py-[5px] text-[11px] font-semibold font-satoshi"
            style={getStatusStyle(ev.status)}
          >
            <Image
              src={getSafeImageUrl(
                getAppointmentCompanionPhotoUrl(ev.companion),
                (ev.companion ?? ev.patient).species.toLowerCase() as ImageType
              )}
              height={18}
              width={18}
              priority
              className="size-[18px] rounded-full object-cover"
              alt={''}
            />
            <span className="truncate max-w-40">{getCompanionDisplayName(ev)}</span>
            <span className="truncate max-w-30 font-normal">{ev.concern || ''}</span>
          </button>
        );
      })}
    </div>
  </div>
);

export default AllDayEventsRow;
