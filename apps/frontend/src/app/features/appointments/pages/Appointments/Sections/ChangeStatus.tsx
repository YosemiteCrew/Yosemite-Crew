import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { changeAppointmentStatus } from '@/app/features/appointments/services/appointmentService';
import { useLoadTeam, useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
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

const normalizeId = (value?: string | null) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  return lowered === 'undefined' || lowered === 'null' ? '' : trimmed;
};

const createNextLead = (
  existingLead: Appointment['lead'] | null | undefined,
  id: string,
  name: string
) => {
  if (!existingLead) {
    return { id, name };
  }

  return {
    ...existingLead,
    id,
    name,
  };
};

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
  useLoadTeam();
  const teams = useTeamForPrimaryOrg();
  const currentStatus: AppointmentStatus =
    normalizeAppointmentStatus(activeAppointment.status) ?? 'REQUESTED';
  const leadOptions = React.useMemo(
    () =>
      teams
        .map((member) => {
          const value = normalizeId(member.practionerId);
          const label = member.name || value;
          if (!value || !label) return null;
          return { value, label };
        })
        .filter((item): item is { value: string; label: string } => item !== null),
    [teams]
  );
  const [selectedLeadId, setSelectedLeadId] = React.useState<string>(
    normalizeId(activeAppointment.lead?.id)
  );

  React.useEffect(() => {
    if (!showModal) return;
    const activeLeadId = normalizeId(activeAppointment.lead?.id);
    if (activeLeadId) {
      setSelectedLeadId(activeLeadId);
      return;
    }
    if (leadOptions.length === 1) {
      setSelectedLeadId(leadOptions[0].value);
      return;
    }
    setSelectedLeadId('');
  }, [activeAppointment.id, activeAppointment.lead?.id, leadOptions, showModal]);

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
      validateBeforeSave={(newStatus) => {
        const needsLeadSelection = currentStatus === 'REQUESTED' && newStatus === 'UPCOMING';
        if (!needsLeadSelection) return null;
        if (normalizeId(selectedLeadId)) return null;
        return 'Select a lead before accepting this appointment.';
      }}
      renderExtraContent={({ selectedStatus, saving }) => {
        const showLeadPicker = currentStatus === 'REQUESTED' && selectedStatus === 'UPCOMING';
        if (!showLeadPicker) return null;
        return (
          <div className={saving ? 'pointer-events-none opacity-60' : ''}>
            <LabelDropdown
              placeholder="Select lead"
              options={leadOptions}
              defaultOption={selectedLeadId}
              onSelect={(option) => setSelectedLeadId(option.value)}
            />
          </div>
        );
      }}
      onSave={async (newStatus) => {
        const selectedLeadName =
          leadOptions.find((option) => option.value === selectedLeadId)?.label ??
          activeAppointment.lead?.name ??
          'Assigned vet';
        const nextLead = createNextLead(activeAppointment.lead, selectedLeadId, selectedLeadName);
        const nextAppointment =
          currentStatus === 'REQUESTED' && newStatus === 'UPCOMING'
            ? {
                ...activeAppointment,
                lead: nextLead,
              }
            : activeAppointment;
        await changeAppointmentStatus(nextAppointment, newStatus);
      }}
    />
  );
};

export default ChangeStatus;
