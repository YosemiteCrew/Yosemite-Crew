import React from 'react';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import CompanionAvatar from '@/app/ui/avatars/CompanionAvatar';
import { IoIosArrowBack } from 'react-icons/io';
import { IoAddOutline, IoFlash } from 'react-icons/io5';
import type { Appointment } from '@yosemite-crew/types';
import { getSafeImageUrl, type ImageType } from '@/app/lib/urls';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import AlertPill from '@/app/features/appointments/pages/AppointmentWorkspace/components/AlertPill';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import EmergencyBadge from '@/app/features/appointments/components/EmergencyBadge';
import VisitTimer from '@/app/features/appointments/pages/AppointmentWorkspace/components/VisitTimer';
import type { CompanionAlert } from '@/app/features/appointments/types/workspace';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

const EMPTY_CLIENT_ALERTS: CompanionAlert[] = [];

type WorkspaceHeaderProps = {
  appointment: Appointment;
  companionName: string;
  alerts: CompanionAlert[];
  /** Read-only client (parent) alerts, surfaced alongside the patient alerts.
   *  Managed from the companion/client modal, not editable here. */
  clientAlerts?: CompanionAlert[];
  onBack: () => void;
  onQuickActions: () => void;
  onHospitalize?: () => void;
  /** Hide the hospitalize action when the encounter is already inpatient. */
  canHospitalize?: boolean;
  canAdmit?: boolean;
  isAdmitting?: boolean;
  onAdmit?: () => void;
  onAddAlert?: () => void;
  onRemoveAlert?: (id: string) => void;
  /** Best-available visit start for the "In room" timer (encounter check-in, else booked start). */
  visitStartAt?: string | Date;
  /** Booked slot end; the timer turns amber past it. */
  bookedEndAt?: string | Date;
  /** Companion photo shown in the 44px identity avatar beside the name. */
  photoUrl?: string;
  /** Companion species, used to pick the species-specific avatar fallback. */
  speciesType?: string;
  /** Single-line companion summary ("Beagle · F, spayed · 4y 2m …") under the name. */
  metaLine?: string;
};

const SPECIES_IMAGE_TYPES = new Set<ImageType>(['dog', 'cat', 'horse', 'other']);

const resolveImageType = (speciesType?: string): ImageType => {
  const candidate = speciesType?.toLowerCase() as ImageType | undefined;
  return candidate && SPECIES_IMAGE_TYPES.has(candidate) ? candidate : 'dog';
};

const HospitalizeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M18.34 17.63C18.34 17.87 18.24 18.09 18.07 18.26C17.9 18.43 17.66 18.52 17.41 18.52H2.6C2.35 18.52 2.12 18.43 1.95 18.26C1.77 18.09 1.67 17.87 1.67 17.63V8.28C1.67 8.15 1.71 8.01 1.77 7.89C1.83 7.77 1.92 7.66 2.03 7.58L9.44 1.69C9.6 1.57 9.8 1.5 10.01 1.5C10.21 1.5 10.41 1.57 10.58 1.69L17.98 7.58C18.09 7.66 18.18 7.77 18.25 7.89C18.31 8.01 18.34 8.15 18.34 8.28V17.63ZM16.49 16.74V8.72L10.01 3.52L3.53 8.72V16.74H16.49Z"
      fill="white"
    />
    <path
      d="M9.17 11.86V13.52C9.17 13.76 9.25 13.96 9.41 14.12C9.57 14.28 9.77 14.36 10.01 14.36C10.24 14.36 10.44 14.28 10.6 14.12C10.76 13.96 10.84 13.76 10.84 13.52V11.86H12.51C12.74 11.86 12.94 11.78 13.1 11.62C13.26 11.46 13.34 11.26 13.34 11.02C13.34 10.79 13.26 10.59 13.1 10.43C12.94 10.27 12.74 10.19 12.51 10.19H10.84V8.52C10.84 8.29 10.76 8.09 10.6 7.93C10.44 7.77 10.24 7.69 10.01 7.69C9.77 7.69 9.57 7.77 9.41 7.93C9.25 8.09 9.17 8.29 9.17 8.52V10.19H7.51C7.27 10.19 7.07 10.27 6.91 10.43C6.75 10.59 6.67 10.79 6.67 11.02C6.67 11.26 6.75 11.46 6.91 11.62C7.07 11.78 7.27 11.86 7.51 11.86H9.17Z"
      fill="white"
    />
  </svg>
);

/**
 * Top header: back arrow, the 44px companion avatar, the bare companion name with
 * the status pill inline (single source of truth — also used in the calendar
 * popover) and a compact metadata line beneath, then the alert pills and Quick
 * Actions on the right.
 */
const WorkspaceHeader = ({
  appointment,
  companionName,
  alerts,
  clientAlerts = EMPTY_CLIENT_ALERTS,
  onBack,
  onQuickActions,
  onHospitalize,
  canHospitalize = true,
  canAdmit = false,
  isAdmitting = false,
  onAdmit,
  onAddAlert,
  onRemoveAlert,
  visitStartAt,
  bookedEndAt,
  photoUrl,
  speciesType,
  metaLine,
}: WorkspaceHeaderProps) => {
  const terminologyText = useCompanionTerminologyText();
  const hasAlerts = alerts.length > 0 || clientAlerts.length > 0 || Boolean(onAddAlert);

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          aria-label="Go back"
          onClick={onBack}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-900 transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          <IoIosArrowBack size={22} aria-hidden="true" />
        </button>
        <AvatarImage
          src={getSafeImageUrl(photoUrl, resolveImageType(speciesType))}
          alt={companionName}
          size={44}
          className="size-11 shrink-0 rounded-full object-cover"
          fallback={
            <CompanionAvatar
              name={companionName}
              size={44}
              textClassName="text-[19px]"
              alt={companionName}
            />
          }
        />
        {/* `shrink-0` here sized this column to its widest line, which is the
            meta line, so the `truncate` below could never fire and the column
            simply grew over the action cluster instead - measured at 768px with
            a realistic breed, "34.6 kg" rendered underneath the visit timer. It
            never scrolled the page, so nothing gave the collision away.

            The column now yields and the meta line spends whatever is left
            before ellipsing. Breed, sex, age and weight all repeat in the
            companion panel, so that line is the right thing to spend.

            The name row is not pinned by a `min-width`: pinning it needs the
            meta line to contribute nothing to intrinsic sizing, and the trick
            that does that (`w-0 min-w-full`) zeroes the max-content
            contribution too, so the column stops growing and the line stays
            clipped at 168px even on a 1512px screen. Measured instead: this
            header only renders at 768px and up (`useIsPhone` hands anything
            narrower to `PhoneWorkspaceShell`), and the tightest reachable
            state - inpatient, ready to admit, a 373px action cluster - still
            leaves the column 219px against a 168px name row. The story below
            pins that margin so a longer label cannot spend it silently. */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1
              className="shrink-0 font-satoshi text-[17px] font-bold leading-[120%] tracking-[-0.02em]"
              style={{ color: 'var(--ink)' }}
            >
              {companionName.split(' ')[0]}
            </h1>
            <AppointmentStatusPill appointment={appointment} />
            {appointment.isEmergency && <EmergencyBadge />}
          </div>
          {metaLine && (
            <span
              className="truncate text-[12.5px] leading-[130%]"
              style={{ color: 'var(--ink-faint)' }}
            >
              {metaLine}
            </span>
          )}
        </div>
        {hasAlerts && (
          /* The strip scrolls with its scrollbar hidden, so when the alerts do
             not fit there was NO cue that any were missing - measured on a real
             patient at 1512px: 666px of pills in a 276px box, with the third one
             cut mid-word. These are standing clinical alerts ("bite risk",
             "needs muzzle"), so silently hiding two thirds of them is the wrong
             failure. A right-edge fade marks the strip as scrollable, and the
             fade costs nothing when the pills fit, because the faded band is
             empty background in that case. */
          <div
            data-testid="workspace-alert-strip"
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 scrollbar-hidden [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]"
          >
            {alerts.map((alert) => (
              <div key={alert.id} className="shrink-0">
                <AlertPill
                  id={alert.id}
                  label={alert.label}
                  severity={alert.severity}
                  onRemove={onRemoveAlert}
                />
              </div>
            ))}
            {clientAlerts.map((alert) => (
              <div key={alert.id} className="shrink-0">
                <AlertPill
                  id={alert.id}
                  label={`Client: ${alert.label}`}
                  severity={alert.severity}
                />
              </div>
            ))}
            {onAddAlert && (
              <GlassTooltip content={terminologyText('Add alerts for patient')} side="bottom">
                <button
                  type="button"
                  aria-label="Add alert"
                  onClick={onAddAlert}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border border-neutral-500 text-neutral-700 transition-colors duration-150 hover:border-text-brand hover:text-blue-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
                >
                  <IoAddOutline size={14} aria-hidden="true" />
                </button>
              </GlassTooltip>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <VisitTimer startAt={visitStartAt} bookedEndAt={bookedEndAt} />
        {canAdmit && onAdmit && (
          <Primary
            text={isAdmitting ? 'Admitting' : 'Admit'}
            onClick={onAdmit}
            isDisabled={isAdmitting}
          />
        )}
        {canHospitalize && (
          <button
            type="button"
            aria-label={terminologyText('Hospitalize patient')}
            onClick={onHospitalize}
            className="flex size-11 items-center justify-center rounded-3xl bg-neutral-900 transition-colors duration-150 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <HospitalizeIcon />
          </button>
        )}
        <Secondary
          text="Quick Actions"
          onClick={onQuickActions}
          icon={<IoFlash aria-hidden="true" />}
          className="bg-neutral-0!"
        />
      </div>
    </div>
  );
};

export default WorkspaceHeader;
