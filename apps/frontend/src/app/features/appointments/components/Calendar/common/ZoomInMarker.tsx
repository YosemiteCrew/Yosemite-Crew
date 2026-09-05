import React from 'react';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import CompanionAvatar from '@/app/ui/avatars/CompanionAvatar';
import { Appointment } from '@yosemite-crew/types';
import { getStatusStyle } from '@/app/config/statusConfig';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import {
  getCompanionDisplayName,
  getMarkerSizing,
} from '@/app/features/appointments/components/Calendar/common/slotHelpers';
import {
  MarkerInteractionProps,
  getMarkerButtonProps,
} from '@/app/features/appointments/components/Calendar/common/markerShared';

type ZoomInMarkerProps = MarkerInteractionProps & {
  ev: Appointment;
  laneIndex: number;
  laneCount: number;
  topPx: number;
  blockHeightPx: number;
};

/** Companion name plus the trimmed service/concern strings the marker renders,
 * and the `title` tooltip that joins all three. */
const getMarkerLabels = (ev: Appointment) => {
  const serviceName = ev.appointmentType?.name?.trim() ?? '';
  const concern = ev.concern?.trim() ?? '';
  const companionDisplayName = getCompanionDisplayName(ev);
  return {
    serviceName,
    concern,
    companionDisplayName,
    markerTitle: [companionDisplayName, serviceName, concern].filter(Boolean).join(' • '),
  };
};

// Frame appointment card: 12px radius over a 1px status outline, thickened to a
// 3px status spine on the leading edge. A requested (not yet confirmed) booking
// draws that outline dashed, keeping the spine solid.
const getAppointmentBlockStyle = (
  ev: Appointment,
  geometry: {
    topPx: number;
    leftPercent: number;
    widthPercent: number;
    laneGapPx: number;
    blockHeightPx: number;
  }
): React.CSSProperties => {
  const statusStyle = getStatusStyle(ev.status);
  const isRequested = String(ev.status ?? '').toUpperCase() === 'REQUESTED';
  const { topPx, leftPercent, widthPercent, laneGapPx, blockHeightPx } = geometry;
  return {
    ...statusStyle,
    borderWidth: '1px',
    borderLeftWidth: '3px',
    borderStyle: isRequested ? 'dashed' : 'solid',
    borderLeftStyle: 'solid',
    borderColor: statusStyle.borderColor,
    top: topPx,
    left: `calc(${leftPercent}% + ${laneGapPx}px)`,
    width: `calc(${widthPercent}% - ${laneGapPx * 2}px)`,
    minHeight: blockHeightPx,
    height: blockHeightPx,
  };
};

// Frame subtitle: 11px in the status text colour. The frame asked for 0.75
// opacity, but these are --status-<x>-text tokens on their own fill, which
// only clear AA at full strength; font-normal against the title's weight is
// what separates them.
const subtitleClass =
  'truncate font-satoshi text-[11px] font-normal leading-[1.2] tracking-[-0.22px]';

type MarkerSubtitleProps = {
  tall: boolean;
  medium: boolean;
  multiLane: boolean;
  serviceName: string;
  concern: string;
};

/** Service/concern lines under the companion name. Tall blocks get one bulleted
 * line each, medium blocks a single joined line, multi-lane blocks the service
 * only, and short single-lane blocks nothing. */
const MarkerSubtitle = ({ tall, medium, multiLane, serviceName, concern }: MarkerSubtitleProps) => {
  if (tall) {
    return (
      <>
        {serviceName && (
          <div className={`${subtitleClass} mt-1.5`}>
            {'• '}
            {serviceName}
          </div>
        )}
        {concern && (
          <div className={`${subtitleClass} mt-1`}>
            {'• '}
            {concern}
          </div>
        )}
      </>
    );
  }
  if (medium && (serviceName || concern)) {
    return (
      <div className={`${subtitleClass} mt-1.5`}>
        {[serviceName, concern].filter(Boolean).join(' • ')}
      </div>
    );
  }
  if (multiLane && serviceName) {
    return <div className={`${subtitleClass} mt-1`}>{serviceName}</div>;
  }
  return null;
};

const ZoomInMarker = ({
  ev,
  laneIndex,
  laneCount,
  topPx,
  blockHeightPx,
  ...interaction
}: ZoomInMarkerProps) => {
  const { serviceName, concern, companionDisplayName, markerTitle } = getMarkerLabels(ev);
  const buttonProps = getMarkerButtonProps(ev, interaction, markerTitle);
  // 2px lane gap on top of the slot's own 4px inset lands the block on the frame's
  // `left: 6px; right: 6px` inset.
  const laneGapPx = 2;
  const widthPercent = 100 / laneCount;
  const leftPercent = widthPercent * laneIndex;

  const {
    multiLane,
    tall,
    medium,
    showImage,
    imgSize,
    verticalPadding,
    horizontalPadding,
    buttonGap,
  } = getMarkerSizing(laneCount, blockHeightPx);
  const cursorClass = buttonProps.draggable
    ? 'cursor-grab active:cursor-grabbing'
    : 'cursor-pointer';

  const subject = ev.companion ?? ev.patient;
  const appointmentBlockStyle = getAppointmentBlockStyle(ev, {
    topPx,
    leftPercent,
    widthPercent,
    laneGapPx,
    blockHeightPx,
  });

  return (
    <div className="absolute z-20 overflow-hidden rounded-[12px]!" style={appointmentBlockStyle}>
      <button
        type="button"
        {...buttonProps}
        className={`size-full flex items-center justify-between ${buttonGap} ${horizontalPadding} text-left ${verticalPadding} ${cursorClass}`}
      >
        {showImage && (
          <div className="flex-none">
            <AvatarImage
              src={getSafeImageUrl(
                getAppointmentCompanionPhotoUrl(ev.companion),
                subject.species.toLowerCase() as ImageType
              )}
              size={imgSize}
              className="rounded-full border border-white/60 object-cover"
              style={{ width: imgSize, height: imgSize }}
              alt=""
              fallback={
                <CompanionAvatar
                  name={subject.name}
                  seed={subject.id}
                  size={imgSize}
                  textClassName="text-[11px]"
                />
              }
            />
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate text-[12.5px] font-bold leading-[1.2] tracking-[-0.25px]">
            {companionDisplayName}
          </div>
          <MarkerSubtitle
            tall={tall}
            medium={medium}
            multiLane={multiLane}
            serviceName={serviceName}
            concern={concern}
          />
        </div>
      </button>
    </div>
  );
};

export default ZoomInMarker;
