import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import {
  allowReschedule,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  getAppointmentCompanionPhotoUrl,
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
} from '@/app/lib/appointments';
import { getStatusStyle } from '@/app/config/statusConfig';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';
import { getAppointmentPaymentDisplay } from '@/app/lib/paymentStatus';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import {
  acceptAppointment,
  rejectAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { useOrgStore } from '@/app/stores/orgStore';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import {
  IoEyeOutline,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoCardOutline,
  IoFlaskOutline,
} from 'react-icons/io5';
import { MdMeetingRoom, MdOutlineAutorenew } from 'react-icons/md';
import { RiHistoryLine } from 'react-icons/ri';
import { FaCheckCircle } from 'react-icons/fa';
import { IoIosCloseCircle } from 'react-icons/io';

type AppointmentPopoverProps = {
  appointment: Appointment;
  invoicesByAppointmentId: Record<string, Invoice>;
  canEditAppointments: boolean;
  popoverDialogRef: React.RefObject<HTMLDialogElement | null>;
  popoverStyle: React.CSSProperties;
  handleViewAppointment: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  handleChangeStatusAppointment?: (appt: Appointment) => void;
  handleChangeRoomAppointment?: (appt: Appointment) => void;
  onClose: () => void;
};

const formatStatusLabel = (status?: string) => {
  if (!status) return 'Unknown';
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatTimeRange = (event: Appointment) => {
  const start = formatDateInPreferredTimeZone(event.startTime, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const end = formatDateInPreferredTimeZone(event.endTime, { hour: 'numeric', minute: '2-digit' });
  return `${start} - ${end}`;
};

const getCompanionDisplayName = (appointment: Appointment) =>
  formatCompanionNameWithOwnerLastName(appointment.companion?.name, appointment.companion?.parent);

const AppointmentPopover: React.FC<AppointmentPopoverProps> = ({
  appointment,
  invoicesByAppointmentId,
  canEditAppointments,
  popoverDialogRef,
  popoverStyle,
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  handleChangeRoomAppointment,
  onClose,
}) => {
  const router = useRouter();
  const orgsById = useOrgStore((s) => s.orgsById);
  const payment = getAppointmentPaymentDisplay(appointment, invoicesByAppointmentId);
  const companionDisplayName = getCompanionDisplayName(appointment);
  const orgType =
    (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';
  const clinicalNotesLabel = getClinicalNotesLabel(orgType);
  const clinicalNotesIntent = getClinicalNotesIntent(orgType);

  return (
    <dialog
      ref={popoverDialogRef}
      open
      className="fixed z-[1000] w-[380px] rounded-2xl border border-card-border bg-white p-3 shadow-[0_18px_45px_rgba(0,0,0,0.14)]"
      style={popoverStyle}
      aria-label="Appointment quick actions"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <Image
            src={getSafeImageUrl(
              getAppointmentCompanionPhotoUrl(appointment.companion),
              appointment.companion.species.toLowerCase() as ImageType
            )}
            height={34}
            width={34}
            className="rounded-full border border-card-border bg-white object-cover"
            style={{ width: 34, height: 34 }}
            alt=""
          />
          <div className="min-w-0">
            <button
              type="button"
              className="text-body-3-emphasis text-text-primary truncate cursor-pointer hover:underline underline-offset-2 text-left"
              onClick={() => {
                router.push(
                  buildAppointmentCompanionHistoryHref(
                    appointment.id,
                    appointment.companion?.id,
                    '/appointments'
                  )
                );
                onClose();
              }}
              title="Open appointment overview"
            >
              {companionDisplayName}
            </button>
            <div className="text-caption-1 text-text-secondary truncate">
              {appointment.companion.breed || '-'} / {appointment.companion.species || '-'}
            </div>
          </div>
        </div>
        <span
          className="text-[10px] leading-4 font-medium px-2 py-1 rounded-full text-white whitespace-nowrap"
          style={{
            backgroundColor: getStatusStyle(appointment.status).backgroundColor || '#1a73e8',
          }}
        >
          {formatStatusLabel(appointment.status)}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-card-border bg-card-hover px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="text-caption-1 text-text-secondary">Time</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {formatTimeRange(appointment)}
        </div>
        <div className="text-caption-1 text-text-secondary">Parent</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {getOwnerFirstName(appointment.companion.parent) || '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">Lead</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {appointment.lead?.name || '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">Speciality</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {appointment.appointmentType?.speciality?.name || '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">Service</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {appointment.appointmentType?.name || '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">Room</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {appointment.room?.name || '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">Payment</div>
        <div
          className="text-caption-1 text-right truncate font-medium"
          style={{ color: payment?.textColor || '#302F2E' }}
        >
          {payment?.label || '-'}
        </div>
      </div>

      <div className="mt-2 text-caption-1 text-text-secondary">Reason</div>
      <div className="text-caption-1 text-text-primary min-h-6 line-clamp-2">
        {appointment.concern || '-'}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-card-border pt-2 flex-wrap">
        {canEditAppointments && isRequestedLikeStatus(appointment.status) && (
          <>
            <GlassTooltip content="Accept request" side="top">
              <button
                type="button"
                title="Accept request"
                className="h-9 w-9 rounded-full! flex items-center justify-center hover:bg-[#E6F4EF] border border-card-border"
                onClick={async () => {
                  await acceptAppointment(appointment);
                  onClose();
                }}
              >
                <FaCheckCircle size={18} color="#54B492" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Decline request" side="top">
              <button
                type="button"
                title="Decline request"
                className="h-9 w-9 rounded-full! flex items-center justify-center hover:bg-[#FDEBEA] border border-card-border"
                onClick={async () => {
                  await rejectAppointment(appointment);
                  onClose();
                }}
              >
                <IoIosCloseCircle size={20} color="#EA3729" />
              </button>
            </GlassTooltip>
          </>
        )}
        {!isRequestedLikeStatus(appointment.status) && (
          <>
            <GlassTooltip content="View appointment" side="top">
              <button
                type="button"
                title="View appointment"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment);
                  onClose();
                }}
              >
                <IoEyeOutline size={18} />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Overview" side="top">
              <button
                type="button"
                title="Appointment overview"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  router.push(
                    buildAppointmentCompanionHistoryHref(
                      appointment.id,
                      appointment.companion?.id,
                      '/appointments'
                    )
                  );
                  onClose();
                }}
              >
                <RiHistoryLine size={17} />
              </button>
            </GlassTooltip>
            {canEditAppointments && canShowStatusChangeAction(appointment.status) && (
              <GlassTooltip content="Change status" side="top">
                <button
                  type="button"
                  title="Change status"
                  className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                  onClick={() => {
                    if (handleChangeStatusAppointment) {
                      handleChangeStatusAppointment(appointment);
                    } else {
                      handleViewAppointment(appointment);
                    }
                    onClose();
                  }}
                >
                  <MdOutlineAutorenew size={18} />
                </button>
              </GlassTooltip>
            )}
            {canEditAppointments && allowReschedule(appointment.status) && (
              <GlassTooltip content="Reschedule" side="top">
                <button
                  type="button"
                  title="Reschedule"
                  className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                  onClick={() => {
                    handleRescheduleAppointment(appointment);
                    onClose();
                  }}
                >
                  <IoCalendarOutline size={18} />
                </button>
              </GlassTooltip>
            )}
            {canEditAppointments && canAssignAppointmentRoom(appointment.status) && (
              <GlassTooltip content="Assign room" side="top">
                <button
                  type="button"
                  title="Assign room"
                  className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                  onClick={() => {
                    handleChangeRoomAppointment?.(appointment);
                    onClose();
                  }}
                >
                  <MdMeetingRoom size={18} />
                </button>
              </GlassTooltip>
            )}
            <GlassTooltip content={clinicalNotesLabel} side="top">
              <button
                type="button"
                title={clinicalNotesLabel}
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment, clinicalNotesIntent);
                  onClose();
                }}
              >
                <IoDocumentTextOutline size={18} />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Finance summary" side="top">
              <button
                type="button"
                title="Finance summary"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment, { label: 'finance', subLabel: 'summary' });
                  onClose();
                }}
              >
                <IoCardOutline size={18} />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Lab tests" side="top">
              <button
                type="button"
                title="Lab tests"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment, { label: 'labs', subLabel: 'idexx-labs' });
                  onClose();
                }}
              >
                <IoFlaskOutline size={18} />
              </button>
            </GlassTooltip>
          </>
        )}
      </div>
    </dialog>
  );
};

export default AppointmentPopover;
