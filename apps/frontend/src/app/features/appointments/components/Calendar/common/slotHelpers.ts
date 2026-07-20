import { Appointment } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';

export const getCompanionDisplayName = (appointment: Appointment) =>
  formatCompanionNameWithOwnerLastName(
    (appointment.companion ?? appointment.patient).name,
    (appointment.companion ?? appointment.patient).parent
  );

export const setCustomDragGhost = (
  event: React.DragEvent<HTMLButtonElement>,
  appointment: Appointment
) => {
  const ghost = document.createElement('img');
  ghost.src = getSafeImageUrl(
    getAppointmentCompanionPhotoUrl(appointment.companion ?? appointment.patient),
    (appointment.companion ?? appointment.patient).species.toLowerCase() as ImageType
  );
  ghost.width = 24;
  ghost.height = 24;
  ghost.style.position = 'fixed';
  ghost.style.top = '-9999px';
  ghost.style.left = '-9999px';
  ghost.style.width = '24px';
  ghost.style.height = '24px';
  ghost.style.borderRadius = '999px';
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, 12, 12);
  globalThis.setTimeout(() => {
    ghost.remove();
  }, 0);
};

export type MarkerSizing = {
  multiLane: boolean;
  tall: boolean;
  medium: boolean;
  showImage: boolean;
  imgSize: number;
  verticalPadding: string;
  horizontalPadding: string;
  buttonGap: string;
};

// Derive the responsive display tier for a zoom-in appointment marker from its lane count
// and rendered height. Extracted to keep the marker map callback under the complexity limit.
export const getMarkerSizing = (laneCount: number, blockHeightPx: number): MarkerSizing => {
  const multiLane = laneCount > 1;
  // tall: ≥72px single-lane — big pic, service + reason on separate lines with •
  const tall = !multiLane && blockHeightPx >= 72;
  // medium: ≥44px single-lane — smaller pic, one subtitle line
  const medium = !multiLane && blockHeightPx >= 44;
  // small: short single-lane slots (e.g. 5-min) — compact avatar, name only
  const small = !multiLane && !medium && !tall;
  const showImage = small || medium || tall;
  // tall: scales 48px (30-min/90px) → 60px (60-min/180px); medium: 34px; small: 24px
  let imgSize: number;
  if (tall) {
    imgSize = Math.min(60, Math.round(blockHeightPx * 0.52));
  } else if (medium) {
    imgSize = 34;
  } else {
    imgSize = 24;
  }
  // The frame pads every full-size appointment card at 8px 12px; only the short
  // single-lane tier tightens vertically so a 5-minute block still fits its name.
  let verticalPadding: string;
  if (tall || medium) {
    verticalPadding = 'py-2';
  } else {
    verticalPadding = 'py-0.5';
  }
  const horizontalPadding = small ? 'pl-1.5 pr-2' : 'pl-3 pr-3';
  const buttonGap = small ? 'gap-1.5' : 'gap-2.5';
  return {
    multiLane,
    tall,
    medium,
    showImage,
    imgSize,
    verticalPadding,
    horizontalPadding,
    buttonGap,
  };
};
