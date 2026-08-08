import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { getStatusStyle } from '@/app/config/statusConfig';
import { getCompanionDisplayName } from '@/app/features/appointments/components/Calendar/common/slotHelpers';
import {
  MarkerInteractionProps,
  getMarkerButtonProps,
} from '@/app/features/appointments/components/Calendar/common/markerShared';

type ZoomOutMarkerProps = MarkerInteractionProps & {
  ev: Appointment;
  marginTopPx: number;
  blockHeightPx: number;
};

// Below this, a single truncated line no longer fits the bar - keep those
// markers bare (colour + accessible name only) rather than clipping text.
const MIN_HEIGHT_FOR_LABEL_PX = 16;

const ZoomOutMarker = ({ ev, marginTopPx, blockHeightPx, ...interaction }: ZoomOutMarkerProps) => {
  const statusStyle = getStatusStyle(ev.status);
  const serviceName = ev.appointmentType?.name?.trim() ?? '';
  const concern = ev.concern?.trim() ?? '';
  const subtitle = [serviceName, concern].filter(Boolean).join(' • ');
  const companionDisplayName = getCompanionDisplayName(ev);
  const markerTitle = subtitle ? `${companionDisplayName} • ${subtitle}` : companionDisplayName;
  const buttonProps = getMarkerButtonProps(ev, interaction, markerTitle);
  const showLabel = blockHeightPx >= MIN_HEIGHT_FOR_LABEL_PX;

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
        className="pointer-events-none absolute inset-y-0 left-0.5 right-0.5 rounded-sm z-10"
        style={{
          backgroundColor: statusStyle.backgroundColor,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: statusStyle.borderColor,
        }}
      />
      <button
        type="button"
        {...buttonProps}
        className={`min-w-0 flex items-center absolute inset-x-0.5 -inset-y-2 z-20 ${
          buttonProps.draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        }`}
      >
        {showLabel ? (
          <span
            className="min-w-0 truncate px-1 text-left font-satoshi text-[9.5px] font-semibold leading-none tracking-[-0.1px]"
            style={{ color: statusStyle.color }}
          >
            {markerTitle}
          </span>
        ) : (
          <span className="sr-only">{markerTitle}</span>
        )}
      </button>
    </div>
  );
};

export default ZoomOutMarker;
