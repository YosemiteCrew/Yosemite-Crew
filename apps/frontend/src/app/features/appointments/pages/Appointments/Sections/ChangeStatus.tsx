import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import {
  changeAppointmentStatus,
  getSlotsForServiceAndDateForPrimaryOrg,
} from '@/app/features/appointments/services/appointmentService';
import { useLoadTeam, useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import {
  AppointmentStatus,
  AppointmentStatusOptions,
  Slot,
} from '@/app/features/appointments/types/appointments';
import {
  canTransitionAppointmentStatus,
  getAllowedAppointmentStatusTransitions,
  getInvalidAppointmentStatusTransitionMessage,
  normalizeAppointmentStatus,
} from '@/app/lib/appointments';
import { getMinutesSinceStartOfDayInPreferredTimeZone } from '@/app/lib/timezone';
import ChangeStatusModal from '@/app/ui/overlays/Modal/ChangeStatusModal';

const normalizeId = (value?: string | null) => {
  const trimmed =
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.trim() ?? '';
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  return lowered === 'undefined' || lowered === 'null' ? '' : trimmed;
};

const parseUtcClockParts = (value?: string) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? '').trim());
  if (!match) return null;
  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
};

const toClockMinutes = (clock: { hours: number; minutes: number }) =>
  clock.hours * 60 + clock.minutes;

const buildSlotDateOnAppointmentDay = (
  appointmentStart: Date,
  slotClock: { hours: number; minutes: number }
) => {
  return new Date(
    Date.UTC(
      appointmentStart.getUTCFullYear(),
      appointmentStart.getUTCMonth(),
      appointmentStart.getUTCDate(),
      slotClock.hours,
      slotClock.minutes,
      0,
      0
    )
  );
};

const doesSlotStartMatchAppointment = (slotStartTime: string, appointmentStart: Date) => {
  const clockParts = parseUtcClockParts(slotStartTime);
  if (clockParts !== null) {
    const appointmentPreferredMinutes =
      getMinutesSinceStartOfDayInPreferredTimeZone(appointmentStart);
    if (toClockMinutes(clockParts) === appointmentPreferredMinutes) {
      return true;
    }
    const slotStart = buildSlotDateOnAppointmentDay(appointmentStart, clockParts);
    return getMinutesSinceStartOfDayInPreferredTimeZone(slotStart) === appointmentPreferredMinutes;
  }
  const slotStart = new Date(slotStartTime);
  return !Number.isNaN(slotStart.getTime()) && slotStart.getTime() === appointmentStart.getTime();
};

const createNextLead = (
  existingLead: Appointment['lead'] | null | undefined,
  id: string,
  name: string
) => {
  const profileUrl = existingLead?.profileUrl;
  if (profileUrl) return { id, name, profileUrl };
  return { id, name };
};

const getSelectedSupportIds = (supportStaff: Appointment['supportStaff']) =>
  (supportStaff ?? [])
    .map((staff) => normalizeId(staff?.id))
    .filter((id): id is string => Boolean(id));

const getAvailableLeadOptions = (
  availableVetIds: string[] | null,
  leadOptions: Array<{ value: string; label: string }>
) => {
  if (availableVetIds === null) return leadOptions;
  const allowed = new Set(availableVetIds);
  return leadOptions.filter((option) => allowed.has(option.value));
};

const getNextAppointmentForStatus = (
  appointment: Appointment,
  selectedLeadId: string,
  selectedSupportIds: string[],
  leadOptions: Array<{ value: string; label: string }>,
  currentStatus: AppointmentStatus,
  newStatus: AppointmentStatus
) => {
  if (!(currentStatus === 'REQUESTED' && newStatus === 'UPCOMING')) {
    return appointment;
  }
  const selectedLeadName =
    leadOptions.find((option) => option.value === selectedLeadId)?.label ??
    appointment.lead?.name ??
    'Assigned vet';
  const nextLead = createNextLead(appointment.lead, selectedLeadId, selectedLeadName);
  const nextSupportStaff = selectedSupportIds.map((id) => ({
    id,
    name: leadOptions.find((option) => option.value === id)?.label ?? id,
  }));
  const nextAppointment = structuredClone(appointment);
  nextAppointment.lead = nextLead;
  nextAppointment.supportStaff = nextSupportStaff;
  return nextAppointment;
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

  // ── Slot-scoped lead availability ─────────────────────────────────────────────
  // When accepting a requested appointment we only offer leads that the bookable-slots
  // API reports as available for this service + slot. `null` = availability not yet
  // resolved (fall back to all leads); an array = the resolved set of available vet ids.
  const [availableVetIds, setAvailableVetIds] = React.useState<string[] | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = React.useState(false);
  const serviceId = normalizeId(activeAppointment.appointmentType?.id);
  const availabilityKey = `${showModal ? 'open' : 'closed'}:${currentStatus}:${serviceId}:${activeAppointment.startTime}`;
  const previousAvailabilityKeyRef = React.useRef(availabilityKey);
  if (previousAvailabilityKeyRef.current !== availabilityKey) {
    previousAvailabilityKeyRef.current = availabilityKey;
    setAvailableVetIds(null);
    setIsLoadingAvailability(false);
  }

  React.useEffect(() => {
    if (!showModal || currentStatus !== 'REQUESTED' || !serviceId) {
      return;
    }
    let cancelled = false;
    const appointmentStart = new Date(activeAppointment.startTime);
    setIsLoadingAvailability(true);
    setAvailableVetIds(null);
    getSlotsForServiceAndDateForPrimaryOrg(serviceId, new Date(activeAppointment.startTime))
      .then((slots: Slot[]) => {
        if (cancelled) return;
        const matchingSlot = slots.find((slot) =>
          doesSlotStartMatchAppointment(slot.startTime, appointmentStart)
        );
        const vetIds = (matchingSlot?.vetIds ?? [])
          .map((vetId) => normalizeId(vetId))
          .filter(Boolean);
        setAvailableVetIds(vetIds);
      })
      .catch(() => {
        // On failure leave availability unresolved so all leads remain selectable.
        if (!cancelled) setAvailableVetIds(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAvailability(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showModal, currentStatus, serviceId, activeAppointment.startTime]);

  // Leads to actually offer: once slot availability resolves, show only leads
  // reported available for that appointment slot.
  const availableLeadOptions = React.useMemo(
    () => getAvailableLeadOptions(availableVetIds, leadOptions),
    [availableVetIds, leadOptions]
  );
  const [selectedLeadId, setSelectedLeadId] = React.useState<string>(() =>
    normalizeId(activeAppointment.lead?.id)
  );
  const [selectedSupportIds, setSelectedSupportIds] = React.useState<string[]>(() =>
    getSelectedSupportIds(activeAppointment.supportStaff)
  );

  React.useEffect(() => {
    if (!showModal) return;
    setSelectedSupportIds(getSelectedSupportIds(activeAppointment.supportStaff));
    const activeLeadId = normalizeId(activeAppointment.lead?.id);
    setSelectedLeadId((previousLeadId) => {
      const canUsePreviousLead =
        !previousLeadId || availableLeadOptions.some((option) => option.value === previousLeadId);
      if (previousLeadId && canUsePreviousLead) return previousLeadId;
      const canUseActiveLead =
        activeLeadId &&
        (availableVetIds === null ||
          availableLeadOptions.some((option) => option.value === activeLeadId));
      if (canUseActiveLead) return activeLeadId;
      if (!activeLeadId && leadOptions.length === 1) return leadOptions[0].value;
      return '';
    });
  }, [
    activeAppointment.id,
    activeAppointment.lead?.id,
    activeAppointment.supportStaff,
    availableLeadOptions,
    availableVetIds,
    leadOptions,
    showModal,
  ]);

  const handleLeadSelect = (option: { value: string }) => {
    setSelectedLeadId(option.value);
    setSelectedSupportIds((prev) => prev.filter((id) => id !== option.value));
  };

  const supportOptions = React.useMemo(
    () => leadOptions.filter((option) => option.value !== normalizeId(selectedLeadId)),
    [leadOptions, selectedLeadId]
  );

  const availableStatusOptions = React.useMemo(() => {
    const transitions = getAllowedAppointmentStatusTransitions(currentStatus);
    const allowed = new Set<AppointmentStatus>(transitions);
    allowed.add(currentStatus);
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
        if (isLoadingAvailability) return 'Checking lead availability for this slot…';
        if (availableVetIds !== null && availableLeadOptions.length === 0) {
          return 'No lead is available for this slot. Reschedule the appointment to accept it.';
        }
        const leadId = normalizeId(selectedLeadId);
        if (!leadId) return 'Select a lead before accepting this appointment.';
        if (!availableLeadOptions.some((option) => option.value === leadId)) {
          return 'Selected lead is not available for this slot.';
        }
        return null;
      }}
      renderExtraContent={({ selectedStatus, saving }) => {
        const showLeadPicker = currentStatus === 'REQUESTED' && selectedStatus === 'UPCOMING';
        if (!showLeadPicker) return null;
        const noLeadsAvailable = availableVetIds !== null && availableLeadOptions.length === 0;
        return (
          <div
            className={
              saving ? 'pointer-events-none opacity-60 flex flex-col gap-3' : 'flex flex-col gap-3'
            }
          >
            <LabelDropdown
              placeholder={isLoadingAvailability ? 'Checking availability…' : 'Select lead'}
              options={availableLeadOptions}
              defaultOption={selectedLeadId}
              onSelect={handleLeadSelect}
              noOptionsMessage={noLeadsAvailable ? 'No lead is available for this slot' : undefined}
            />
            {noLeadsAvailable ? (
              <p className="px-4 text-caption-2 text-text-error">
                No lead is available for this slot. Reschedule the appointment to accept it.
              </p>
            ) : null}
            <MultiSelectDropdown
              placeholder="Select support staff (optional)"
              options={supportOptions}
              value={selectedSupportIds}
              onChange={setSelectedSupportIds}
            />
          </div>
        );
      }}
      onSave={async (newStatus) => {
        const nextAppointment = getNextAppointmentForStatus(
          activeAppointment,
          selectedLeadId,
          selectedSupportIds,
          leadOptions,
          currentStatus,
          newStatus
        );
        await changeAppointmentStatus(nextAppointment, newStatus);
      }}
    />
  );
};

export default ChangeStatus;
