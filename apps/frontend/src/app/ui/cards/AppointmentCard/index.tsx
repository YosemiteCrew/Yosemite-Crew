import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { allowCalendarDrag } from '@/app/lib/appointments';
import AppointmentCardContent from '@/app/features/appointments/components/AppointmentCardContent';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { IoIosCalendar } from 'react-icons/io';
import { IoEyeOutline, IoCardOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { MdOutlineAutorenew, MdScience } from 'react-icons/md';

type AppointmentCardProps = {
  appointment: Appointment;
  handleViewAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  getSoapViewIntent: (appointment: Appointment) => AppointmentViewIntent;
  handleRescheduleAppointment: (appointment: Appointment) => void;
  handleChangeStatusAppointment?: (appointment: Appointment) => void;
  canEditAppointments: boolean;
};

const AppointmentCard = ({
  appointment,
  handleViewAppointment,
  getSoapViewIntent,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  canEditAppointments,
}: AppointmentCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <AppointmentCardContent appointment={appointment} />
      <div className="flex gap-3 w-full">
        {appointment.status === 'REQUESTED' ? (
          <>
            <button className="text-body-4-emphasis w-full text-[#54B492]! bg-[#E6F4EF] rounded-2xl! h-12 flex items-center justify-center cursor-pointer">
              Accept
            </button>
            <button className="text-body-4-emphasis w-full text-[#EA3729]! bg-[#FDEBEA] rounded-2xl! h-12 flex items-center justify-center cursor-pointer">
              Cancel
            </button>
          </>
        ) : (
          <div className="flex gap-2 w-full flex-wrap">
            <button
              onClick={() => handleViewAppointment(appointment)}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
              title="View"
            >
              <IoEyeOutline size={20} color="#302F2E" />
            </button>
            {canEditAppointments && (
              <button
                onClick={() => handleChangeStatusAppointment?.(appointment)}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                title="Change status"
              >
                <MdOutlineAutorenew size={18} color="#302F2E" />
              </button>
            )}
            {canEditAppointments && allowCalendarDrag(appointment.status) && (
              <button
                onClick={() => handleRescheduleAppointment(appointment)}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                title="Reschedule"
              >
                <IoIosCalendar size={18} color="#302F2E" />
              </button>
            )}
            <button
              onClick={() => handleViewAppointment(appointment, getSoapViewIntent(appointment))}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
              title="SOAP"
            >
              <IoDocumentTextOutline size={18} color="#302F2E" />
            </button>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentCard;
