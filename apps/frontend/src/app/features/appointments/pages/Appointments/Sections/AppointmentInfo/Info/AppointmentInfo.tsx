import EditableAccordion, { FieldConfig } from '@/app/ui/primitives/Accordion/EditableAccordion';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { useServiceStore } from '@/app/stores/serviceStore';
import {
  AppointmentStatus,
  AppointmentStatusOptions,
  Slot,
} from '@/app/features/appointments/types/appointments';
import { buildUtcDateFromDateAndTime, getDurationMinutes } from '@/app/lib/date';
import { Appointment } from '@yosemite-crew/types';
import React, { useEffect, useMemo, useState } from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import DateTimePickerSection from '@/app/features/appointments/components/DateTimePickerSection';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { formatDisplayDate } from '@/app/features/inventory/pages/Inventory/utils';
import { formatTimeLabel } from '@/app/lib/forms';

const getAppointmentFields = ({
  RoomOptions,
}: {
  RoomOptions: { label: string; value: string }[];
}) =>
  [
    { label: 'Reason', key: 'concern', type: 'text' },
    {
      label: 'Room',
      key: 'room',
      type: 'dropdown',
      options: RoomOptions,
    },
    {
      label: 'Service',
      key: 'service',
      type: 'text',
      editable: false,
    },
    {
      label: 'Date',
      key: 'date',
      type: 'date',
      editable: false,
    },
    {
      label: 'Time',
      key: 'time',
      type: 'time',
      editable: false,
    },
    {
      label: 'Status',
      key: 'status',
      type: 'select',
      options: AppointmentStatusOptions,
    },
  ] satisfies FieldConfig[];

const getStaffFields = ({ TeamOptions }: { TeamOptions: { label: string; value: string }[] }) =>
  [
    {
      label: 'Lead',
      key: 'lead',
      type: 'select',
      options: TeamOptions,
      editable: false,
    },
    {
      label: 'Staff',
      key: 'staff',
      type: 'multiSelect',
      options: TeamOptions,
    },
  ] satisfies FieldConfig[];

type AppointmentInfoProps = {
  activeAppointment: Appointment;
};

const AppointmentInfo = ({ activeAppointment }: AppointmentInfoProps) => {
  const rooms = useRoomsForPrimaryOrg();
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();
  const getServicesBySpecialityId = useServiceStore.getState().getServicesBySpecialityId;
  const [isEditingAppointment, setIsEditingAppointment] = useState(false);
  const [appointmentValues, setAppointmentValues] = useState({
    concern: '',
    room: '',
    specialityId: '',
    serviceId: '',
    status: '',
    leadId: '',
    supportIds: [] as string[],
  });
  const [errors, setErrors] = useState<{
    specialityId?: string;
    serviceId?: string;
    slot?: string;
    leadId?: string;
  }>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [timeSlots, setTimeSlots] = useState<Slot[]>([]);

  const RoomOptions = useMemo(
    () =>
      rooms?.map((room) => ({
        label: room.name,
        value: room.id,
      })),
    [rooms]
  );

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId || team._id,
        value: team.practionerId || team._id,
      })),
    [teams]
  );

  const SpecialitiesOptions = useMemo(
    () =>
      specialities?.map((speciality) => ({
        label: speciality.name,
        value: speciality._id || speciality.name,
      })) ?? [],
    [specialities]
  );

  const services = useMemo(() => {
    if (!appointmentValues.specialityId) return [];
    return getServicesBySpecialityId(appointmentValues.specialityId);
  }, [appointmentValues.specialityId, getServicesBySpecialityId]);

  const ServicesOptions = useMemo(
    () =>
      services?.map((service) => ({
        label: service.name,
        value: service.id,
      })) ?? [],
    [services]
  );

  const LeadOptions = useMemo(() => {
    if (!teams?.length || !selectedSlot) return [];
    const slot = timeSlots.find((s) => s.startTime === selectedSlot.startTime);
    if (!slot?.vetIds?.length) return [];
    const vetIdSet = new Set(slot.vetIds);
    return teams
      .filter((team) => {
        const teamId = team.practionerId || team._id;
        return teamId ? vetIdSet.has(teamId) : false;
      })
      .map((team) => ({
        label: team.name || team.practionerId || team._id,
        value: team.practionerId || team._id,
      }));
  }, [teams, timeSlots, selectedSlot]);

  const staffFields = useMemo(() => getStaffFields({ TeamOptions }), [TeamOptions]);

  const appointmentFields = useMemo(() => getAppointmentFields({ RoomOptions }), [RoomOptions]);

  useEffect(() => {
    setAppointmentValues({
      concern: activeAppointment.concern ?? '',
      room: activeAppointment.room?.id ?? '',
      specialityId: activeAppointment.appointmentType?.speciality?.id ?? '',
      serviceId: activeAppointment.appointmentType?.id ?? '',
      status: activeAppointment.status ?? '',
      leadId: activeAppointment.lead?.id ?? '',
      supportIds: activeAppointment.supportStaff?.map((s) => s.id) ?? [],
    });
    setSelectedDate(new Date(activeAppointment.appointmentDate));
    setSelectedSlot(null);
    setTimeSlots([]);
    setErrors({});
  }, [activeAppointment]);

  useEffect(() => {
    if (!isEditingAppointment) return;
    if (!appointmentValues.serviceId || !selectedDate) {
      setTimeSlots([]);
      setSelectedSlot(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const slots = await getSlotsForServiceAndDateForPrimaryOrg(
          appointmentValues.serviceId,
          selectedDate
        );
        if (cancelled) return;
        setTimeSlots(slots);
        const currentStart = activeAppointment.startTime
          ? new Date(activeAppointment.startTime).toISOString().substring(11, 16)
          : '';
        const currentEnd = activeAppointment.endTime
          ? new Date(activeAppointment.endTime).toISOString().substring(11, 16)
          : '';
        const matchingSlot =
          slots.find((slot) => slot.startTime === currentStart && slot.endTime === currentEnd) ??
          slots[0] ??
          null;
        setSelectedSlot(matchingSlot);
      } catch (error) {
        console.log(error);
        if (!cancelled) {
          setTimeSlots([]);
          setSelectedSlot(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isEditingAppointment,
    appointmentValues.serviceId,
    selectedDate,
    activeAppointment.startTime,
    activeAppointment.endTime,
  ]);

  const AppointmentInfoData = useMemo(
    () => ({
      concern: activeAppointment.concern ?? '',
      room: activeAppointment.room?.id ?? '',
      service: activeAppointment.appointmentType?.name ?? '',
      date: activeAppointment.appointmentDate ?? '',
      time: activeAppointment.startTime ?? '',
      status: activeAppointment.status ?? '',
    }),
    [activeAppointment]
  );

  const StaffInfoData = useMemo(
    () => ({
      lead: activeAppointment.lead?.id ?? '',
      staff: activeAppointment.supportStaff?.map((s) => s.id) ?? '',
    }),
    [activeAppointment]
  );

  const handleStaffUpdate = async (values: any) => {
    try {
      const teamIds = values.staff;
      const team =
        teamIds?.length > 0
          ? teams
              .filter((member) => {
                const memberId = member.practionerId || member._id;
                return memberId ? teamIds.includes(memberId) : false;
              })
              .map((member) => ({
                id: member.practionerId || member._id,
                name: member.name || member.practionerId || member._id,
              }))
          : [];
      const formData: Appointment = {
        ...activeAppointment,
        supportStaff: team,
      };
      await updateAppointment(formData);
    } catch (error) {
      console.log(error);
    }
  };

  const canEditByStatus = useMemo(() => {
    const status = activeAppointment.status as AppointmentStatus | undefined;
    if (!status) return false;

    return !['CANCELLED', 'NO_SHOW'].includes(status);
  }, [activeAppointment.status]);

  const handleAppointmentEditCancel = () => {
    setIsEditingAppointment(false);
    setErrors({});
    setAppointmentValues({
      concern: activeAppointment.concern ?? '',
      room: activeAppointment.room?.id ?? '',
      specialityId: activeAppointment.appointmentType?.speciality?.id ?? '',
      serviceId: activeAppointment.appointmentType?.id ?? '',
      status: activeAppointment.status ?? '',
      leadId: activeAppointment.lead?.id ?? '',
      supportIds: activeAppointment.supportStaff?.map((s) => s.id) ?? [],
    });
    setSelectedDate(new Date(activeAppointment.appointmentDate));
    setSelectedSlot(null);
    setTimeSlots([]);
  };

  const canEditAppointments = canEditByStatus;

  const handleAppointmentSave = async () => {
    const formErrors: typeof errors = {};
    if (!appointmentValues.specialityId) formErrors.specialityId = 'Please select a speciality';
    if (!appointmentValues.serviceId) formErrors.serviceId = 'Please select a service';
    if (!selectedSlot) formErrors.slot = 'Please select a slot';
    if (!appointmentValues.leadId) formErrors.leadId = 'Please select a lead';
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;

    const foundRoom = rooms.find((r) => r.id === appointmentValues.room);
    const room = foundRoom ? { id: foundRoom.id, name: foundRoom.name } : undefined;
    const speciality = specialities.find(
      (item) => (item._id || item.name) === appointmentValues.specialityId
    );
    const service = services.find((item) => item.id === appointmentValues.serviceId);
    const leadMember = teams.find((member) => {
      const id = member.practionerId || member._id;
      return id === appointmentValues.leadId;
    });
    const supportStaff = teams
      .filter((member) => {
        const id = member.practionerId || member._id;
        return id ? appointmentValues.supportIds.includes(id) : false;
      })
      .map((member) => ({
        id: member.practionerId || member._id,
        name: member.name || member.practionerId || member._id,
      }));

    const updatedAppointment: Appointment = {
      ...activeAppointment,
      concern: appointmentValues.concern,
      room,
      status: appointmentValues.status as AppointmentStatus,
      appointmentType: {
        id: appointmentValues.serviceId,
        name: service?.name || activeAppointment.appointmentType?.name || '',
        speciality: {
          id: appointmentValues.specialityId,
          name: speciality?.name || activeAppointment.appointmentType?.speciality?.name || '',
        },
      },
      lead: leadMember
        ? {
            id: leadMember.practionerId || leadMember._id,
            name: leadMember.name || leadMember.practionerId || leadMember._id,
          }
        : activeAppointment.lead,
      supportStaff,
      startTime: buildUtcDateFromDateAndTime(selectedDate, selectedSlot!.startTime),
      endTime: buildUtcDateFromDateAndTime(selectedDate, selectedSlot!.endTime),
      appointmentDate: buildUtcDateFromDateAndTime(selectedDate, selectedSlot!.startTime),
      durationMinutes: getDurationMinutes(selectedSlot!.startTime, selectedSlot!.endTime),
    };

    await updateAppointment(updatedAppointment);
    setIsEditingAppointment(false);
    setErrors({});
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-3 w-full">
        <Accordion
          title="Appointments details"
          defaultOpen={true}
          showEditIcon={canEditAppointments}
          isEditing={isEditingAppointment}
          onEditClick={() => setIsEditingAppointment(true)}
        >
          {isEditingAppointment ? (
            <div className="flex flex-col gap-3 mt-2">
              <LabelDropdown
                placeholder="Speciality"
                onSelect={(option) =>
                  setAppointmentValues((prev) => ({
                    ...prev,
                    specialityId: option.value,
                    serviceId: '',
                  }))
                }
                defaultOption={appointmentValues.specialityId}
                error={errors.specialityId}
                options={SpecialitiesOptions}
              />
              <LabelDropdown
                placeholder="Service"
                onSelect={(option) =>
                  setAppointmentValues((prev) => ({ ...prev, serviceId: option.value }))
                }
                defaultOption={appointmentValues.serviceId}
                error={errors.serviceId}
                options={ServicesOptions}
              />
              <FormDesc
                intype="text"
                inname="Describe concern"
                value={appointmentValues.concern}
                inlabel="Describe concern"
                onChange={(event) =>
                  setAppointmentValues((prev) => ({ ...prev, concern: event.target.value }))
                }
                className="min-h-[120px]!"
              />
              <DateTimePickerSection
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                selectedSlot={selectedSlot}
                setSelectedSlot={setSelectedSlot}
                timeSlots={timeSlots}
                slotError={errors.slot}
                leadId={appointmentValues.leadId}
                leadError={errors.leadId}
                leadOptions={LeadOptions}
                onLeadSelect={(option) =>
                  setAppointmentValues((prev) => ({ ...prev, leadId: option.value }))
                }
                supportStaffIds={appointmentValues.supportIds}
                teamOptions={TeamOptions}
                onSupportStaffChange={(ids) =>
                  setAppointmentValues((prev) => ({ ...prev, supportIds: ids }))
                }
              />
              <LabelDropdown
                placeholder="Room"
                onSelect={(option) =>
                  setAppointmentValues((prev) => ({ ...prev, room: option.value }))
                }
                defaultOption={appointmentValues.room}
                options={RoomOptions}
              />
              <LabelDropdown
                placeholder="Status"
                onSelect={(option) =>
                  setAppointmentValues((prev) => ({ ...prev, status: option.value }))
                }
                defaultOption={appointmentValues.status}
                options={AppointmentStatusOptions}
              />
            </div>
          ) : (
            <div className="flex flex-col">
              {appointmentFields.map((field) => {
                const data = (AppointmentInfoData as Record<string, any>)[field.key];
                let formattedDate = '';
                if (data instanceof Date) {
                  formattedDate = formatDisplayDate(data.toISOString());
                } else if (typeof data === 'string') {
                  formattedDate = formatDisplayDate(data);
                }
                let display: string;
                if (field.key === 'room') {
                  display = RoomOptions.find((option) => option.value === data)?.label || '-';
                } else if (field.key === 'status') {
                  display = data || '-';
                } else if (field.key === 'date') {
                  display = formattedDate || '-';
                } else if (field.key === 'time') {
                  display = formatTimeLabel(data) || '-';
                } else {
                  display = data || '-';
                }
                return (
                  <div
                    key={field.key}
                    className="py-2.5! flex items-center gap-2 justify-between border-t border-card-border"
                  >
                    <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
                    <div className="text-body-4 text-text-primary text-right">{display}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Accordion>
        {isEditingAppointment && (
          <div className="grid grid-cols-2 gap-3 w-full">
            <Secondary href="#" onClick={handleAppointmentEditCancel} text="Cancel" />
            <Primary href="#" text="Save" onClick={handleAppointmentSave} />
          </div>
        )}
      </div>
      <EditableAccordion
        key={'staff-key'}
        title={'Staff details'}
        fields={staffFields}
        data={StaffInfoData}
        defaultOpen={true}
        onSave={handleStaffUpdate}
        showEditIcon={canEditAppointments}
      />
    </div>
  );
};

export default AppointmentInfo;
