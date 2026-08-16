import Image from 'next/image';
import clsx from 'clsx';
import { Appointment } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { getAppointmentRoomDisplay } from '@/app/lib/appointmentRoomDisplay';
import { AppointmentModePill } from '@/app/features/appointments/components/AppointmentCardContent';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoIosCalendar } from 'react-icons/io';
import {
  IoCardOutline,
  IoDocumentTextOutline,
  IoEyeOutline,
  IoLocationOutline,
  IoTimeOutline,
  IoWarning,
} from 'react-icons/io5';
import { RiHistoryLine } from 'react-icons/ri';
import { MdMeetingRoom, MdOutlineAutorenew, MdScience } from 'react-icons/md';
import { rejectAppointment } from '@/app/features/appointments/services/appointmentService';
import {
  allowCalendarDrag,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  getAppointmentCompanionPhotoUrl,
  getAllowedAppointmentStatusTransitions,
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
} from '@/app/lib/appointments';
import { canEnterAppointmentWorkspace } from '@/app/lib/appointmentWorkspace';
import AppointmentPaymentBadge from '@/app/features/appointments/components/AppointmentPaymentBadge';
import {
  getBoardOrgType,
  isMutedBoardStatus,
  normalizeStatus,
} from '@/app/features/appointments/components/appointmentBoardHelpers';

type AppointmentBoardCardProps = {
  appointment: Appointment;
  encountersById: ReturnType<typeof useAppointmentWorkspaceStore.getState>['encountersById'];
  roomUnitsById: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitsById'];
  canEditAppointments: boolean;
  draggedAppointmentId: string | null;
  invoicesByAppointmentId: ReturnType<typeof createInvoiceByAppointmentId>;
  orgsById: Record<string, { type?: string } | undefined>;
  handleAppointmentDragStart: (
    event: React.DragEvent<HTMLElement>,
    appointmentId?: string | null
  ) => void;
  setDraggedAppointmentId: (id: string | null) => void;
  openAppointment: (appointment: Appointment) => void;
  openAppointmentHistory: (appointment: Appointment) => void;
  openChangeStatus: (appointment: Appointment) => void;
  openReschedule: (appointment: Appointment) => void;
  openChangeRoom: (appointment: Appointment) => void;
  openAppointmentWorkspace: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  updatingStatusId: string | null;
};

type BoardCardCompanion = NonNullable<Appointment['companion']>;

const iconButtonClass =
  'size-7 rounded-full! border border-[var(--hairline)] bg-neutral-0 flex items-center justify-center';

/** "Beagle · Lena Hartmann" — falls back to species when the breed is unknown. */
const buildCompanionSubtitle = (companion: BoardCardCompanion) =>
  [companion.breed || companion.species, companion.parent?.name].filter(Boolean).join(' · ');

/**
 * "Waiting 12 min" — how long a checked-in patient has actually been waiting,
 * measured from the moment they were checked in at the desk.
 *
 * BACKEND WORK REQUIRED: this reads `Appointment.checkedInAt`, which nothing
 * persists yet. It is deliberately NOT derived from the booked `startTime` —
 * that measures how late the appointment is running, not how long the patient
 * has waited, and a patient who checks in early would show a wait of zero while
 * a late-running clinic would show a wait for a patient who just arrived.
 * Without a real check-in stamp the label is omitted entirely.
 */
const buildWaitingLabel = (checkedInAt?: string | Date | null): string => {
  if (!checkedInAt) return '';
  const checkedIn = new Date(checkedInAt).getTime();
  if (Number.isNaN(checkedIn)) return '';
  const minutes = Math.floor((Date.now() - checkedIn) / 60000);
  return minutes >= 1 ? `Waiting ${minutes} min` : '';
};

/** "Annual check-up · Dr. Weber" — the design's service line under the companion. */
const buildServiceLine = (appointment: Appointment) =>
  [appointment.appointmentType?.name, appointment.lead?.name].filter(Boolean).join(' · ') || '-';

/**
 * Tooltip + round icon button — the shape every action-bar control shares.
 * The click always stops short of the card's own open-on-click overlay.
 */
const BoardCardIconButton = ({
  tooltip,
  label,
  title,
  onPress,
  children,
}: {
  tooltip: string;
  label: string;
  title?: string;
  onPress: () => void;
  children: React.ReactNode;
}) => (
  <GlassTooltip content={tooltip} side="bottom">
    <button
      type="button"
      aria-label={label}
      className={iconButtonClass}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPress();
      }}
      title={title}
    >
      {children}
    </button>
  </GlassTooltip>
);

/** Avatar, companion name, subtitle and the emergency pill. */
const BoardCardHeader = ({
  companion,
  companionDisplayName,
  isEmergency,
  onOpenHistory,
}: {
  companion: BoardCardCompanion;
  companionDisplayName: string;
  isEmergency: boolean;
  onOpenHistory: () => void;
}) => (
  <div className="relative z-10 flex items-start justify-between gap-2">
    <div className="flex min-w-0 items-center gap-2.5">
      <Image
        src={getSafeImageUrl(
          getAppointmentCompanionPhotoUrl(companion),
          companion.species.toLowerCase() as ImageType
        )}
        height={28}
        width={28}
        className="size-[28px] shrink-0 rounded-full border border-card-border bg-neutral-0 object-cover"
        alt=""
      />
      <div className="min-w-0">
        <button
          type="button"
          className="block max-w-full truncate text-[13px] leading-4 font-bold text-[var(--ink)] cursor-pointer hover:underline underline-offset-2 text-left"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenHistory();
          }}
          title="Open appointment overview"
        >
          {companionDisplayName}
        </button>
        <div className="truncate text-[11px] leading-4 text-[var(--ink-faint)]">
          {buildCompanionSubtitle(companion)}
        </div>
      </div>
    </div>
    {isEmergency && (
      <span
        className="shrink-0 inline-flex items-center gap-[3px] rounded-full border border-[var(--danger-border)] bg-[var(--danger-bg)] px-[7px] py-[2px] text-[8.5px] font-bold uppercase leading-none text-[var(--danger-text)]"
        aria-label="Emergency appointment"
      >
        <IoWarning size={8} aria-hidden="true" />
        Emergency
      </span>
    )}
  </div>
);

/** Start time and room on the left, mode + payment badges on the right. */
const BoardCardMetaRow = ({
  appointment,
  roomDisplay,
  invoicesByAppointmentId,
}: {
  appointment: Appointment;
  roomDisplay: ReturnType<typeof getAppointmentRoomDisplay>;
  invoicesByAppointmentId: ReturnType<typeof createInvoiceByAppointmentId>;
}) => (
  <div className="relative z-10 flex items-center justify-between gap-2">
    <div className="flex min-w-0 items-center gap-2.5 text-[11.5px] font-semibold text-text-tertiary">
      <span className="flex shrink-0 items-center gap-1">
        <IoTimeOutline size={12} aria-hidden="true" />
        {formatDateInPreferredTimeZone(appointment.startTime, {
          hour: 'numeric',
          minute: '2-digit',
        })}
      </span>
      {roomDisplay.value && roomDisplay.value !== '-' && (
        <span className="flex min-w-0 items-center gap-1">
          <IoLocationOutline size={12} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{roomDisplay.value}</span>
        </span>
      )}
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      <AppointmentModePill appointment={appointment} className="w-fit" iconSize={12} />
      <AppointmentPaymentBadge
        appointment={appointment}
        invoicesByAppointmentId={invoicesByAppointmentId}
      />
    </div>
  </div>
);

/** Requested-like cards get a straight accept / decline pair instead of the action bar. */
const BoardCardRequestActions = ({
  appointment,
  onAccept,
}: {
  appointment: Appointment;
  onAccept: () => void;
}) => (
  <div className="relative z-10 flex items-center justify-end gap-1.5">
    <button
      type="button"
      aria-label="Accept request"
      className="rounded-full! px-2.5 py-1 text-[10.5px] font-bold leading-none"
      style={{ backgroundColor: 'var(--cta)', color: 'var(--cta-text)' }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onAccept();
      }}
    >
      Accept
    </button>
    <button
      type="button"
      aria-label="Decline request"
      className="rounded-full! border px-2.5 py-1 text-[10.5px] font-bold leading-none"
      style={{ borderColor: 'var(--divider)', color: 'var(--ink-muted)' }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void rejectAppointment(appointment).catch((error) => {
          console.error('Failed to decline appointment request:', error);
        });
      }}
    >
      Decline
    </button>
  </div>
);

type BoardCardActionBarProps = Pick<
  AppointmentBoardCardProps,
  | 'appointment'
  | 'canEditAppointments'
  | 'orgsById'
  | 'openAppointment'
  | 'openAppointmentHistory'
  | 'openChangeStatus'
  | 'openReschedule'
  | 'openChangeRoom'
  | 'openAppointmentWorkspace'
>;

/** The icon rail: every action a non-requested card can take, gated by status + permission. */
const BoardCardActionBar = ({
  appointment,
  canEditAppointments,
  orgsById,
  openAppointment,
  openAppointmentHistory,
  openChangeStatus,
  openReschedule,
  openChangeRoom,
  openAppointmentWorkspace,
}: BoardCardActionBarProps) => {
  const orgType = getBoardOrgType(appointment, orgsById);
  const clinicalNotesLabel = getClinicalNotesLabel(orgType);

  return (
    <div className="relative z-10 flex items-center gap-1.5 flex-wrap max-w-[184px]">
      {canEnterAppointmentWorkspace(appointment.status) && (
        <BoardCardIconButton
          tooltip="View appointment"
          label="View appointment"
          onPress={() => openAppointment(appointment)}
        >
          <IoEyeOutline size={14} color="var(--ink-soft)" />
        </BoardCardIconButton>
      )}
      <BoardCardIconButton
        tooltip="Overview"
        label="Overview"
        title="Appointment overview"
        onPress={() => openAppointmentHistory(appointment)}
      >
        <RiHistoryLine size={13} color="var(--ink-soft)" />
      </BoardCardIconButton>
      {canEditAppointments && canShowStatusChangeAction(appointment.status) && (
        <BoardCardIconButton
          tooltip="Change status"
          label="Change status"
          onPress={() => openChangeStatus(appointment)}
        >
          <MdOutlineAutorenew size={13} color="var(--ink-soft)" />
        </BoardCardIconButton>
      )}
      {canEditAppointments && allowCalendarDrag(appointment.status) && (
        <BoardCardIconButton
          tooltip="Reschedule"
          label="Reschedule"
          onPress={() => openReschedule(appointment)}
        >
          <IoIosCalendar size={13} color="var(--ink-soft)" />
        </BoardCardIconButton>
      )}
      {canEditAppointments && canAssignAppointmentRoom(appointment.status) && (
        <BoardCardIconButton
          tooltip="Assign room"
          label="Assign room"
          onPress={() => openChangeRoom(appointment)}
        >
          <MdMeetingRoom size={13} color="var(--ink-soft)" />
        </BoardCardIconButton>
      )}
      <BoardCardIconButton
        tooltip={clinicalNotesLabel}
        label={clinicalNotesLabel}
        title={clinicalNotesLabel}
        onPress={() => openAppointmentWorkspace(appointment, getClinicalNotesIntent(orgType))}
      >
        <IoDocumentTextOutline size={13} color="var(--ink-soft)" />
      </BoardCardIconButton>
      <BoardCardIconButton
        tooltip="Finance summary"
        label="Finance summary"
        onPress={() =>
          openAppointmentWorkspace(appointment, { label: 'finance', subLabel: 'summary' })
        }
      >
        <IoCardOutline size={13} color="var(--ink-soft)" />
      </BoardCardIconButton>
      <BoardCardIconButton
        tooltip="Lab tests"
        label="Lab tests"
        onPress={() =>
          openAppointmentWorkspace(appointment, { label: 'labs', subLabel: 'idexx-labs' })
        }
      >
        <MdScience size={13} color="var(--ink-soft)" />
      </BoardCardIconButton>
    </div>
  );
};

const AppointmentBoardCard = ({
  appointment,
  encountersById,
  roomUnitsById,
  canEditAppointments,
  draggedAppointmentId,
  invoicesByAppointmentId,
  orgsById,
  handleAppointmentDragStart,
  setDraggedAppointmentId,
  openAppointment,
  openAppointmentHistory,
  openChangeStatus,
  openReschedule,
  openChangeRoom,
  openAppointmentWorkspace,
  updatingStatusId,
}: AppointmentBoardCardProps) => {
  const companion = appointment.companion ?? appointment.patient;
  const roomDisplay = getAppointmentRoomDisplay(appointment, encountersById, roomUnitsById);
  const isCardDraggable =
    canEditAppointments && getAllowedAppointmentStatusTransitions(appointment.status).length > 0;
  const companionDisplayName = formatCompanionNameWithOwnerLastName(
    companion.name,
    companion.parent
  );
  const isDragging = draggedAppointmentId === (appointment.id ?? null);
  const isEmergency = !!appointment.isEmergency;
  // Completed / cancelled / no-show cards recede — design drops them to 72% and
  // removes the lift shadow so live work stays dominant in the column.
  const isMuted = isMutedBoardStatus(normalizeStatus(appointment.status));
  const isRequested = isRequestedLikeStatus(appointment.status);
  // Checked-in patients are the ones actually waiting in the clinic, so the design
  // lifts their card with a 1.5px status outline, a deeper shadow, the wait so far
  // and a direct "Start visit" action. The wait needs a real check-in stamp, so it
  // is absent until the backend supplies one — the rest of the emphasis still applies.
  const isCheckedIn = normalizeStatus(appointment.status) === 'CHECKED_IN';
  const waitingLabel = buildWaitingLabel(appointment.checkedInAt);

  let emphasisClass = 'border-card-border';
  if (isEmergency) {
    emphasisClass = 'border-[var(--danger-border)] border-l-[3px] border-l-[var(--danger)]';
  } else if (isCheckedIn) {
    emphasisClass = 'border-[1.5px] border-[var(--status-checked-in-border)]';
  }
  const emphasisShadowClass = isCheckedIn
    ? 'shadow-[0_4px_14px_var(--sh08)]'
    : 'shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]';

  return (
    <article
      aria-label={
        isCardDraggable
          ? `Draggable appointment ${companionDisplayName}`
          : `Appointment ${companionDisplayName}`
      }
      className={clsx(
        'relative w-full shrink-0 overflow-hidden rounded-[13px]! bg-neutral-0 px-[14px] py-[12px] text-left transition-colors flex flex-col items-stretch justify-start gap-2 border',
        emphasisClass,
        isMuted ? 'opacity-[0.72] shadow-none' : emphasisShadowClass,
        isDragging
          ? 'opacity-60 shadow-none'
          : 'hover:border-input-border-active! hover:bg-card-hover!',
        isCardDraggable && 'cursor-grab active:cursor-grabbing'
      )}
      draggable={isCardDraggable}
      onDragStart={(event) => handleAppointmentDragStart(event, appointment.id)}
      onDragEnd={() => setDraggedAppointmentId(null)}
    >
      {!isCardDraggable && (
        <button
          type="button"
          aria-label={`Open appointment ${companionDisplayName}`}
          className="absolute inset-0 z-0 w-full h-full cursor-pointer bg-transparent border-0 p-0"
          onClick={() => openAppointment(appointment)}
        />
      )}

      <BoardCardHeader
        companion={companion}
        companionDisplayName={companionDisplayName}
        isEmergency={isEmergency}
        onOpenHistory={() => openAppointmentHistory(appointment)}
      />

      <div className="relative z-10 line-clamp-2 text-[12px] leading-4 text-[var(--ink-muted)]">
        {buildServiceLine(appointment)}
      </div>

      {isCheckedIn && (
        <div className="relative z-10 flex items-center justify-between gap-2">
          {waitingLabel && (
            <span className="text-[10.5px] font-semibold" style={{ color: 'var(--ink-faint)' }}>
              {waitingLabel}
            </span>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openAppointmentWorkspace(appointment);
            }}
            className="ml-auto rounded-full px-2.5 py-1 text-[10.5px] font-bold text-white"
            style={{ background: 'var(--blue-strong)' }}
          >
            Start visit
          </button>
        </div>
      )}

      <BoardCardMetaRow
        appointment={appointment}
        roomDisplay={roomDisplay}
        invoicesByAppointmentId={invoicesByAppointmentId}
      />

      {isRequested && (
        <BoardCardRequestActions
          appointment={appointment}
          onAccept={() => openChangeStatus(appointment)}
        />
      )}

      {!isRequested && (
        <BoardCardActionBar
          appointment={appointment}
          canEditAppointments={canEditAppointments}
          orgsById={orgsById}
          openAppointment={openAppointment}
          openAppointmentHistory={openAppointmentHistory}
          openChangeStatus={openChangeStatus}
          openReschedule={openReschedule}
          openChangeRoom={openChangeRoom}
          openAppointmentWorkspace={openAppointmentWorkspace}
        />
      )}

      {updatingStatusId === appointment.id && (
        <div className="relative z-10 text-[10px] text-text-tertiary">Updating…</div>
      )}
    </article>
  );
};

export default AppointmentBoardCard;
