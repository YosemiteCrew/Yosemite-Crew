import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { changeAppointmentStatus } from '@/app/features/appointments/services/appointmentService';
import {
  AppointmentStatus,
  AppointmentStatusOptions,
} from '@/app/features/appointments/types/appointments';
import {
  canTransitionAppointmentStatus,
  getAllowedAppointmentStatusTransitions,
  getInvalidAppointmentStatusTransitionMessage,
  normalizeAppointmentStatus,
} from '@/app/lib/appointments';
import ChangeStatusModal from '@/app/ui/overlays/Modal/ChangeStatusModal';

type ChangeStatusProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment;
  preferredStatus?: AppointmentStatus | null;
};

const ChangeStatus = ({
  showModal,
  setShowModal,
  activeAppointment,
  preferredStatus = null,
}: ChangeStatusProps) => {
  const currentStatus: AppointmentStatus =
    normalizeAppointmentStatus(activeAppointment.status) ?? 'REQUESTED';

  const availableStatusOptions = React.useMemo(() => {
    const allowed = new Set<AppointmentStatus>([
      currentStatus,
      ...getAllowedAppointmentStatusTransitions(currentStatus),
    ]);
    return AppointmentStatusOptions.filter((option) =>
      allowed.has(option.value as AppointmentStatus)
    ) as Array<{ value: AppointmentStatus; label: string }>;
  }, [currentStatus]);

  return (
    <ChangeStatusModal<AppointmentStatus>
      showModal={showModal}
      setShowModal={setShowModal}
      currentStatus={currentStatus}
      defaultStatus="REQUESTED"
      preferredStatus={preferredStatus}
      statusOptions={availableStatusOptions}
      placeholder="Appointment status"
      canTransition={canTransitionAppointmentStatus}
      getInvalidMessage={getInvalidAppointmentStatusTransitionMessage}
      onSave={async (newStatus) => {
        await changeAppointmentStatus(activeAppointment, newStatus);
      }}
    />
  );
};

export default ChangeStatus;
