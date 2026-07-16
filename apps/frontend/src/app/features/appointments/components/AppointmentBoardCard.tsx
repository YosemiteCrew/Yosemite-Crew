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
import { FaCheckCircle } from 'react-icons/fa';
import { IoIosCalendar, IoIosCloseCircle } from 'react-icons/io';
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

const iconButtonClass =
  'size-7 rounded-full! border border-black-text! bg-neutral-0 flex items-center justify-center';

/** "Beagle · Lena Hartmann" — falls back to species when the breed is unknown. */
const buildCompanionSubtitle = (companion: NonNullable<Appointment['companion']>) =>
  [companion.breed || companion.species, companion.parent?.name].filter(Boolean).join(' · ');

/** "Annual check-up · Dr. Weber" — the design's service line under the companion. */
const buildServiceLine = (appointment: Appointment) =>
  [appointment.appointmentType?.name, appointment.lead?.name].filter(Boolean).join(' · ') || '-';

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

  return (
    <article
      aria-label={
        isCardDraggable
          ? `Draggable appointment ${companionDisplayName}`
          : `Appointment ${companionDisplayName}`
      }
      className={clsx(
        'relative w-full shrink-0 overflow-hidden rounded-[13px]! bg-neutral-0 px-3.5 py-3 text-left transition-colors flex flex-col items-stretch justify-start gap-2 border',
        isEmergency
          ? 'border-[var(--danger-border)] border-l-[3px] border-l-[var(--danger)]'
          : 'border-card-border',
        isMuted
          ? 'opacity-[0.72] shadow-none'
          : 'shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]',
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

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image
            src={getSafeImageUrl(
              getAppointmentCompanionPhotoUrl(companion),
              companion.species.toLowerCase() as ImageType
            )}
            height={28}
            width={28}
            className="size-7 shrink-0 rounded-full border border-card-border bg-neutral-0 object-cover"
            alt=""
          />
          <div className="min-w-0">
            <button
              type="button"
              className="block max-w-full truncate text-[13px] leading-4 font-bold text-[var(--ink)] cursor-pointer hover:underline underline-offset-2 text-left"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAppointmentHistory(appointment);
              }}
              title="Open appointment overview"
            >
              {companionDisplayName}
            </button>
            <div className="truncate text-[11px] leading-4 text-text-tertiary">
              {buildCompanionSubtitle(companion)}
            </div>
          </div>
        </div>
        {isEmergency && (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[var(--danger-border)] bg-[var(--danger-bg)] px-2 py-[3px] text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-[var(--danger-text)]"
            aria-label="Emergency appointment"
          >
            <IoWarning size={9} aria-hidden="true" />
            Emergency
          </span>
        )}
      </div>

      <div className="relative z-10 line-clamp-2 text-[12px] leading-4 text-text-secondary">
        {buildServiceLine(appointment)}
      </div>

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
          <AppointmentModePill
            appointment={appointment}
            className="h-6 px-2.5 text-[10px]"
            iconSize={12}
          />
          <AppointmentPaymentBadge
            appointment={appointment}
            invoicesByAppointmentId={invoicesByAppointmentId}
          />
        </div>
      </div>

      {isRequested && (
        <div className="relative z-10 flex items-center justify-end gap-1">
          <GlassTooltip content="Accept request" side="bottom">
            <button
              type="button"
              aria-label="Accept request"
              className="size-7 rounded-full! bg-success-100 border border-success-200 flex items-center justify-center"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openChangeStatus(appointment);
              }}
            >
              <FaCheckCircle size={14} color="var(--color-success-400)" />
            </button>
          </GlassTooltip>
          <GlassTooltip content="Decline request" side="bottom">
            <button
              type="button"
              aria-label="Decline request"
              className="size-7 rounded-full! bg-danger-100 border border-danger-200 flex items-center justify-center"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void rejectAppointment(appointment);
              }}
            >
              <IoIosCloseCircle size={16} color="var(--color-danger-600)" />
            </button>
          </GlassTooltip>
        </div>
      )}

      {!isRequested && (
        <div className="relative z-10 flex items-center gap-1.5 flex-wrap max-w-[184px]">
          {canEnterAppointmentWorkspace(appointment.status) && (
            <GlassTooltip content="View appointment" side="bottom">
              <button
                type="button"
                aria-label="View appointment"
                className={iconButtonClass}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openAppointment(appointment);
                }}
              >
                <IoEyeOutline size={14} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
          )}
          <GlassTooltip content="Overview" side="bottom">
            <button
              type="button"
              aria-label="Overview"
              className={iconButtonClass}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAppointmentHistory(appointment);
              }}
              title="Appointment overview"
            >
              <RiHistoryLine size={13} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
          {canEditAppointments && canShowStatusChangeAction(appointment.status) && (
            <GlassTooltip content="Change status" side="bottom">
              <button
                type="button"
                aria-label="Change status"
                className={iconButtonClass}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openChangeStatus(appointment);
                }}
              >
                <MdOutlineAutorenew size={13} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
          )}
          {canEditAppointments && allowCalendarDrag(appointment.status) && (
            <GlassTooltip content="Reschedule" side="bottom">
              <button
                type="button"
                aria-label="Reschedule"
                className={iconButtonClass}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openReschedule(appointment);
                }}
              >
                <IoIosCalendar size={13} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
          )}
          {canEditAppointments && canAssignAppointmentRoom(appointment.status) && (
            <GlassTooltip content="Assign room" side="bottom">
              <button
                type="button"
                aria-label="Assign room"
                className={iconButtonClass}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openChangeRoom(appointment);
                }}
              >
                <MdMeetingRoom size={13} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
          )}
          <GlassTooltip
            content={getClinicalNotesLabel(getBoardOrgType(appointment, orgsById))}
            side="bottom"
          >
            <button
              type="button"
              aria-label={getClinicalNotesLabel(getBoardOrgType(appointment, orgsById))}
              className={iconButtonClass}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAppointmentWorkspace(
                  appointment,
                  getClinicalNotesIntent(getBoardOrgType(appointment, orgsById))
                );
              }}
              title={getClinicalNotesLabel(getBoardOrgType(appointment, orgsById))}
            >
              <IoDocumentTextOutline size={13} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
          <GlassTooltip content="Finance summary" side="bottom">
            <button
              type="button"
              aria-label="Finance summary"
              className={iconButtonClass}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAppointmentWorkspace(appointment, { label: 'finance', subLabel: 'summary' });
              }}
            >
              <IoCardOutline size={13} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
          <GlassTooltip content="Lab tests" side="bottom">
            <button
              type="button"
              aria-label="Lab tests"
              className={iconButtonClass}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAppointmentWorkspace(appointment, { label: 'labs', subLabel: 'idexx-labs' });
              }}
            >
              <MdScience size={13} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
        </div>
      )}

      {updatingStatusId === appointment.id && (
        <div className="relative z-10 text-[10px] text-text-tertiary">Updating…</div>
      )}
    </article>
  );
};

export default AppointmentBoardCard;
