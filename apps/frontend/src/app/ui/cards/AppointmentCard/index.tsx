import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import {
  allowCalendarDrag,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
} from '@/app/lib/appointments';
import AppointmentCardContent from '@/app/features/appointments/components/AppointmentCardContent';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { IoIosCalendar, IoIosCloseCircle } from 'react-icons/io';
import { IoEyeOutline, IoCardOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { MdMeetingRoom, MdOutlineAutorenew, MdScience } from 'react-icons/md';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { FaCheckCircle } from 'react-icons/fa';
import {
  acceptAppointment,
  rejectAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { useOrgStore } from '@/app/stores/orgStore';

type AppointmentCardProps = {
  appointment: Appointment;
  handleViewAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  getSoapViewIntent: (appointment: Appointment) => AppointmentViewIntent;
  handleRescheduleAppointment: (appointment: Appointment) => void;
  handleChangeStatusAppointment?: (appointment: Appointment) => void;
  handleChangeRoomAppointment?: (appointment: Appointment) => void;
  canEditAppointments: boolean;
};

const AppointmentCard = ({
  appointment,
  handleViewAppointment,
  getSoapViewIntent,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  handleChangeRoomAppointment,
  canEditAppointments,
}: AppointmentCardProps) => {
  const orgsById = useOrgStore((s) => s.orgsById);
  const orgType =
    (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';
  const clinicalNotesLabel = getClinicalNotesLabel(orgType);
  const clinicalNotesIntent = getClinicalNotesIntent(orgType);

  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <AppointmentCardContent appointment={appointment} />
      <div className="flex gap-3 w-full">
        {isRequestedLikeStatus(appointment.status) ? (
          <>
            <GlassTooltip content="Accept request" side="bottom">
              <button
                className="h-10 w-10 rounded-full! flex items-center justify-center cursor-pointer"
                style={{ background: '#E6F4EF' }}
                onClick={() => void acceptAppointment(appointment)}
              >
                <FaCheckCircle size={22} color="#54B492" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Decline request" side="bottom">
              <button
                className="h-10 w-10 rounded-full! flex items-center justify-center cursor-pointer"
                style={{ background: '#FDEBEA' }}
                onClick={() => void rejectAppointment(appointment)}
              >
                <IoIosCloseCircle size={24} color="#EA3729" />
              </button>
            </GlassTooltip>
          </>
        ) : (
          <div className="flex gap-2 w-full flex-wrap max-w-[184px]">
            <GlassTooltip content="View appointment" side="bottom">
              <button
                onClick={() => handleViewAppointment(appointment)}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                title="View"
              >
                <IoEyeOutline size={20} color="#302F2E" />
              </button>
            </GlassTooltip>
            {canEditAppointments && canShowStatusChangeAction(appointment.status) && (
              <GlassTooltip content="Change status" side="bottom">
                <button
                  onClick={() => handleChangeStatusAppointment?.(appointment)}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                  title="Change status"
                >
                  <MdOutlineAutorenew size={18} color="#302F2E" />
                </button>
              </GlassTooltip>
            )}
            {canEditAppointments && allowCalendarDrag(appointment.status) && (
              <GlassTooltip content="Reschedule" side="bottom">
                <button
                  onClick={() => handleRescheduleAppointment(appointment)}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                  title="Reschedule"
                >
                  <IoIosCalendar size={18} color="#302F2E" />
                </button>
              </GlassTooltip>
            )}
            {canEditAppointments && canAssignAppointmentRoom(appointment.status) && (
              <GlassTooltip content="Assign room" side="bottom">
                <button
                  onClick={() => handleChangeRoomAppointment?.(appointment)}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                  title="Assign room"
                >
                  <MdMeetingRoom size={18} color="#302F2E" />
                </button>
              </GlassTooltip>
            )}
            <GlassTooltip content={clinicalNotesLabel} side="bottom">
              <button
                onClick={() =>
                  handleViewAppointment(
                    appointment,
                    orgType === 'HOSPITAL' ? getSoapViewIntent(appointment) : clinicalNotesIntent
                  )
                }
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                title={clinicalNotesLabel}
              >
                <IoDocumentTextOutline size={18} color="#302F2E" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Finance summary" side="bottom">
              <button
                onClick={() =>
                  handleViewAppointment(appointment, {
                    label: 'finance',
                    subLabel: 'summary',
                  })
                }
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                title="Finance"
              >
                <IoCardOutline size={18} color="#302F2E" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Lab tests" side="bottom">
              <button
                onClick={() =>
                  handleViewAppointment(appointment, {
                    label: 'labs',
                    subLabel: 'idexx-labs',
                  })
                }
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                title="Lab tests"
              >
                <MdScience size={18} color="#302F2E" />
              </button>
            </GlassTooltip>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentCard;
