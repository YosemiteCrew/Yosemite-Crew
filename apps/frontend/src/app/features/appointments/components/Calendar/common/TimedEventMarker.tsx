import React from 'react';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import CompanionAvatar from '@/app/ui/avatars/CompanionAvatar';
import { getStatusStyle } from '@/app/config/statusConfig';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { EVENT_HORIZONTAL_GAP_PX } from '@/app/features/appointments/components/Calendar/helpers';
import { LaidOutEvent } from '@/app/features/appointments/types/calendar';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { getCompanionDisplayName } from '@/app/features/appointments/components/Calendar/common/dayCalendarHelpers';
import {
  MarkerInteractionProps,
  getMarkerButtonProps,
} from '@/app/features/appointments/components/Calendar/common/markerShared';

type TimedEventMarkerProps = MarkerInteractionProps & {
  ev: LaidOutEvent;
  yScale: number;
  zoomMode: CalendarZoomMode;
};

type MarkerStatusStyle = ReturnType<typeof getStatusStyle>;

/** Patient name plus the "service • concern" subtitle, and the hover/`title` line built from both. */
const getTimedMarkerLabels = (ev: LaidOutEvent) => {
  const serviceName = ev.appointmentType?.name?.trim() ?? '';
  const concern = ev.concern?.trim() ?? '';
  const subtitle = [serviceName, concern].filter(Boolean).join(' • ');
  const companionDisplayName = getCompanionDisplayName(ev);
  return {
    subtitle,
    companionDisplayName,
    markerTitle: subtitle ? `${companionDisplayName} • ${subtitle}` : companionDisplayName,
  };
};

/** Absolute placement of the card in its column, plus the status tint it carries when zoomed in. */
const getTimedMarkerBox = (
  ev: LaidOutEvent,
  yScale: number,
  isZoomOut: boolean,
  statusStyle: MarkerStatusStyle
) => {
  const widthPercent = 100 / ev.columnsCount;
  const leftPercent = widthPercent * ev.columnIndex;
  const horizontalGapPx = EVENT_HORIZONTAL_GAP_PX;
  const verticalGapPx = 0;
  const renderedHeight = Math.max(
    ev.heightPx * yScale - (isZoomOut ? 0 : verticalGapPx),
    isZoomOut ? 3 : 40
  );
  return {
    // Below this, not even a single line of the smallest legible label fits -
    // an extremely short or heavily overlapping slot stays a color-only sliver.
    canShowZoomOutLabel: isZoomOut && renderedHeight >= 11,
    style: {
      top: ev.topPx * yScale,
      height: renderedHeight,
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
    } as React.CSSProperties,
  };
};

/** Zoomed-in card body: the stacked name/subtitle block beside the companion avatar. */
const TimedMarkerExpandedBody = ({
  ev,
  companionDisplayName,
  subtitle,
}: {
  ev: LaidOutEvent;
  companionDisplayName: string;
  subtitle: string;
}) => {
  const avatarSubject = ev.companion ?? ev.patient;
  return (
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
        <AvatarImage
          src={getSafeImageUrl(
            getAppointmentCompanionPhotoUrl(ev.companion),
            avatarSubject.species.toLowerCase() as ImageType
          )}
          size={26}
          priority
          className="rounded-full border border-white/60 object-cover"
          style={{ width: 26, height: 26 }}
          alt=""
          fallback={
            <CompanionAvatar
              name={avatarSubject.name}
              seed={avatarSubject.id}
              size={26}
              textClassName="text-[12px]"
            />
          }
        />
      </div>
    </>
  );
};

const TimedEventMarker = ({ ev, yScale, zoomMode, ...interaction }: TimedEventMarkerProps) => {
  const isZoomOut = zoomMode === 'out';
  const statusStyle = getStatusStyle(ev.status);
  const { subtitle, companionDisplayName, markerTitle } = getTimedMarkerLabels(ev);
  const buttonProps = getMarkerButtonProps(ev, interaction, markerTitle);
  const { canShowZoomOutLabel, style } = getTimedMarkerBox(ev, yScale, isZoomOut, statusStyle);

  return (
    <div
      className={`absolute scrollbar-hidden ${isZoomOut ? 'rounded-md! p-0 bg-transparent' : 'rounded-xl! px-2 py-1.5 overflow-hidden'}`}
      style={style}
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
      {/* Zoomed-out cards still need at least the patient name visible, not
          just a color sliver - hover/focus (native `title` on the button below)
          surfaces the fuller time/service/status detail. Sized to the real
          slot bounds, not the button's enlarged hit target below. */}
      {canShowZoomOutLabel && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1 right-1 flex items-center truncate text-[8px] font-bold leading-none"
          style={{ color: statusStyle.color }}
        >
          {companionDisplayName}
        </span>
      )}
      <button
        type="button"
        {...buttonProps}
        className={`min-w-0 ${
          buttonProps.draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        } ${isZoomOut ? 'absolute inset-x-0 -inset-y-2 z-20' : 'size-full flex items-center gap-2'}`}
      >
        {!isZoomOut && (
          <TimedMarkerExpandedBody
            ev={ev}
            companionDisplayName={companionDisplayName}
            subtitle={subtitle}
          />
        )}
        {isZoomOut && <span className="sr-only">{markerTitle}</span>}
      </button>
    </div>
  );
};

export default TimedEventMarker;
