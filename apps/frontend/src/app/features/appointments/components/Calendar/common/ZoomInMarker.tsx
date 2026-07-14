import React from 'react';
import Image from 'next/image';
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

const ZoomInMarker = ({
  ev,
  laneIndex,
  laneCount,
  topPx,
  blockHeightPx,
  ...interaction
}: ZoomInMarkerProps) => {
  const statusStyle = getStatusStyle(ev.status);
  const serviceName = ev.appointmentType?.name?.trim() ?? '';
  const concern = ev.concern?.trim() ?? '';
  const companionDisplayName = getCompanionDisplayName(ev);
  const markerTitle = [companionDisplayName, serviceName, concern].filter(Boolean).join(' • ');
  const buttonProps = getMarkerButtonProps(ev, interaction, markerTitle);
  const laneGapPx = 3;
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

  const subtitleClass =
    'truncate font-satoshi text-[11px] font-normal leading-[1.2] tracking-[-0.22px]';
  let subtitleNode: React.ReactNode = null;
  if (tall) {
    subtitleNode = (
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
  } else if (medium && (serviceName || concern)) {
    subtitleNode = (
      <div className={`${subtitleClass} mt-1.5`}>
        {[serviceName, concern].filter(Boolean).join(' • ')}
      </div>
    );
  } else if (multiLane && serviceName) {
    subtitleNode = <div className={`${subtitleClass} mt-1`}>{serviceName}</div>;
  }

  const appointmentBlockStyle: React.CSSProperties = {
    ...statusStyle,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: statusStyle.borderColor,
    top: topPx,
    left: `calc(${leftPercent}% + ${laneGapPx}px)`,
    width: `calc(${widthPercent}% - ${laneGapPx * 2}px)`,
    minHeight: blockHeightPx,
    height: blockHeightPx,
  };

  return (
    <div className="absolute z-20 overflow-hidden rounded-2xl!" style={appointmentBlockStyle}>
      <button
        type="button"
        {...buttonProps}
        className={`size-full flex items-center justify-between ${buttonGap} ${horizontalPadding} text-left ${verticalPadding} ${cursorClass}`}
      >
        {showImage && (
          <div className="flex-none">
            <Image
              src={getSafeImageUrl(
                getAppointmentCompanionPhotoUrl(ev.companion),
                (ev.companion ?? ev.patient).species.toLowerCase() as ImageType
              )}
              height={imgSize}
              width={imgSize}
              className="rounded-full border border-white/60 object-cover"
              style={{ width: imgSize, height: imgSize }}
              alt=""
            />
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate text-caption-1 font-bold leading-[1.2]">
            {companionDisplayName}
          </div>
          {subtitleNode}
        </div>
      </button>
    </div>
  );
};

export default ZoomInMarker;
