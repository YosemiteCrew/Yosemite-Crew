import Image from 'next/image';
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
import { IoCardOutline, IoDocumentTextOutline, IoEyeOutline } from 'react-icons/io5';
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
import { getBoardOrgType } from '@/app/features/appointments/components/appointmentBoardHelpers';

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

  return (
    <article
      aria-label={
        isCardDraggable
          ? `Draggable appointment ${companionDisplayName}`
          : `Appointment ${companionDisplayName}`
      }
      className={`relative w-full min-h-[142px] shrink-0 rounded-2xl! overflow-hidden border border-card-border bg-white px-4 py-3 text-left transition-colors flex flex-col items-stretch justify-start ${
        draggedAppointmentId === (appointment.id ?? null)
          ? 'opacity-60 shadow-none'
          : 'hover:border-input-border-active! hover:bg-card-hover!'
      } ${isCardDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
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
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-caption-1 font-semibold text-text-primary">
            <button
              type="button"
              className="break-words cursor-pointer hover:underline underline-offset-2 text-left"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAppointmentHistory(appointment);
              }}
              title="Open appointment overview"
            >
              {companionDisplayName}
            </button>
            <div className="break-words text-[10px] font-normal text-text-secondary">
              Speciality: {appointment.appointmentType?.speciality?.name || '-'}
            </div>
            <div className="break-words text-[10px] font-normal text-text-secondary">
              Service: {appointment.appointmentType?.name || '-'}
            </div>
            <div className="break-words text-[10px] font-normal text-text-secondary">
              Reason: {appointment.concern || '-'}
            </div>
            <div className="break-words text-[10px] font-normal text-text-secondary">
              {roomDisplay.label}: {roomDisplay.value}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Image
            src={getSafeImageUrl(
              getAppointmentCompanionPhotoUrl(companion),
              companion.species.toLowerCase() as ImageType
            )}
            height={24}
            width={24}
            className="size-6 rounded-full border border-card-border bg-white object-cover"
            alt=""
          />
          <div className="text-[10px] text-text-secondary whitespace-nowrap">
            {formatDateInPreferredTimeZone(appointment.startTime, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
          <AppointmentModePill
            appointment={appointment}
            className="h-6 px-2.5 text-[10px]"
            iconSize={12}
          />
        </div>
      </div>
      <div className="relative z-10 pt-1 pb-1 border-t border-card-border/60 flex items-center justify-between gap-2">
        <div className="text-[10px] text-text-secondary break-words">
          Lead: {appointment.lead?.name || '-'}
        </div>
        <AppointmentPaymentBadge
          appointment={appointment}
          invoicesByAppointmentId={invoicesByAppointmentId}
        />
      </div>
      {isRequestedLikeStatus(appointment.status) && (
        <div className="relative z-10 mt-2 flex items-center justify-end gap-1">
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
      {!isRequestedLikeStatus(appointment.status) && (
        <div className="relative z-10 mt-2 flex items-center gap-1.5 flex-wrap max-w-[184px]">
          {canEnterAppointmentWorkspace(appointment.status) && (
            <GlassTooltip content="View appointment" side="bottom">
              <button
                type="button"
                aria-label="View appointment"
                className="size-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openAppointment(appointment);
                }}
              >
                <IoEyeOutline size={16} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
          )}
          <GlassTooltip content="Overview" side="bottom">
            <button
              type="button"
              aria-label="Overview"
              className="size-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAppointmentHistory(appointment);
              }}
              title="Appointment overview"
            >
              <RiHistoryLine size={15} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
          {canEditAppointments && canShowStatusChangeAction(appointment.status) && (
            <GlassTooltip content="Change status" side="bottom">
              <button
                type="button"
                aria-label="Change status"
                className="size-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openChangeStatus(appointment);
                }}
              >
                <MdOutlineAutorenew size={15} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
          )}
          {canEditAppointments && allowCalendarDrag(appointment.status) && (
            <GlassTooltip content="Reschedule" side="bottom">
              <button
                type="button"
                aria-label="Reschedule"
                className="size-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openReschedule(appointment);
                }}
              >
                <IoIosCalendar size={15} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
          )}
          {canEditAppointments && canAssignAppointmentRoom(appointment.status) && (
            <GlassTooltip content="Assign room" side="bottom">
              <button
                type="button"
                aria-label="Assign room"
                className="size-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openChangeRoom(appointment);
                }}
              >
                <MdMeetingRoom size={15} color="var(--color-neutral-900)" />
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
              className="size-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
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
              <IoDocumentTextOutline size={15} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
          <GlassTooltip content="Finance summary" side="bottom">
            <button
              type="button"
              aria-label="Finance summary"
              className="size-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAppointmentWorkspace(appointment, { label: 'finance', subLabel: 'summary' });
              }}
            >
              <IoCardOutline size={15} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
          <GlassTooltip content="Lab tests" side="bottom">
            <button
              type="button"
              aria-label="Lab tests"
              className="size-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAppointmentWorkspace(appointment, { label: 'labs', subLabel: 'idexx-labs' });
              }}
            >
              <MdScience size={15} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
        </div>
      )}
      {updatingStatusId === appointment.id && (
        <div className="relative z-10 mt-1 text-[10px] text-text-secondary">Updating…</div>
      )}
    </article>
  );
};

export default AppointmentBoardCard;
