import { Appointment } from '@yosemite-crew/types';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { rejectAppointment } from '@/app/features/appointments/services/appointmentService';
import { FaCheckCircle } from 'react-icons/fa';
import { IoIosCloseCircle } from 'react-icons/io';

type RequestActionButtonsProps = {
  appointment: Appointment;
  onAccept?: (appointment: Appointment) => void;
  onClose: () => void;
};

const RequestActionButtons = ({ appointment, onAccept, onClose }: RequestActionButtonsProps) => (
  <div className="flex shrink-0 items-center gap-2">
    <GlassTooltip content="Accept request" side="top">
      <button
        type="button"
        title="Accept request"
        aria-label="Accept request"
        className="flex size-10 shrink-0 items-center justify-center rounded-full! border border-success-200 bg-success-100 hover:bg-success-200"
        onClick={() => {
          onAccept?.(appointment);
          onClose();
        }}
      >
        <FaCheckCircle size={18} color="var(--color-success-400)" aria-hidden="true" />
      </button>
    </GlassTooltip>
    <GlassTooltip content="Decline request" side="top">
      <button
        type="button"
        title="Decline request"
        aria-label="Decline request"
        className="flex size-10 shrink-0 items-center justify-center rounded-full! border border-danger-200 bg-danger-100 hover:bg-danger-200"
        onClick={async () => {
          try {
            await rejectAppointment(appointment);
            onClose();
          } catch (error) {
            console.error('Failed to decline appointment request:', error);
          }
        }}
      >
        <IoIosCloseCircle size={20} color="var(--color-danger-600)" aria-hidden="true" />
      </button>
    </GlassTooltip>
  </div>
);

export default RequestActionButtons;
