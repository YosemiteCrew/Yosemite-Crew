import { Primary } from '@/app/ui/primitives/Buttons';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { Slot } from '@/app/features/appointments/types/appointments';
import { buildUtcDateFromDateAndTime, getDurationMinutes, toUtcCalendarDate } from '@/app/lib/date';
import { Appointment } from '@yosemite-crew/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import DateTimePickerSection from '@/app/features/appointments/components/DateTimePickerSection';
import { allowReschedule } from '@/app/lib/appointments';
import { useNotify } from '@/app/hooks/useNotify';

type RescheduleProp = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment;
};

const Reschedule = ({ showModal, setShowModal, activeAppointment }: RescheduleProp) => {
  const { notify } = useNotify();
  const teams = useTeamForPrimaryOrg();
  const [formData, setFormData] = useState<Appointment>(activeAppointment);
  const [selectedDate, setSelectedDate] = useState<Date>(
    toUtcCalendarDate(activeAppointment.appointmentDate)
  );
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [timeSlots, setTimeSlots] = useState<Slot[]>([]);
  const [formDataErrors, setFormDataErrors] = useState<{
    leadId?: string;
    duration?: string;
    slot?: string;
  }>({});

  const getLeadOptionsForSlot = useCallback(
    (slot: Slot | null) => {
      if (!teams?.length || !slot) return [];
      const foundSlot = timeSlots.find(
        (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
      );
      if (!foundSlot?.vetIds?.length) return [];
      const vetIdSet = new Set(foundSlot.vetIds);
      return teams
        .filter((team) => {
          const id = team.practionerId || team._id;
          return !!id && vetIdSet.has(id);
        })
        .map((team) => ({
          label: team.name || team.practionerId || team._id,
          value: team.practionerId || team._id,
        }));
    },
    [teams, timeSlots]
  );

  useEffect(() => {
    if (activeAppointment) {
      setFormData(activeAppointment);
      setSelectedDate(toUtcCalendarDate(activeAppointment.appointmentDate));
    }
  }, [activeAppointment]);

  const LeadOptions = useMemo(() => {
    return getLeadOptionsForSlot(selectedSlot);
  }, [getLeadOptionsForSlot, selectedSlot]);

  useEffect(() => {
    if (!selectedSlot) return;
    const options = getLeadOptionsForSlot(selectedSlot);
    const currentLeadId = formData.lead?.id || '';

    if (options.length === 0) {
      setSelectedSlot(null);
      setFormData((prev) => ({ ...prev, lead: undefined }));
      setFormDataErrors((prev) => ({
        ...prev,
        slot: 'No lead is available for this slot. Please choose another slot.',
        leadId: 'No lead is available for this slot.',
      }));
      return;
    }

    if (options.length === 1) {
      const onlyLead = options[0];
      if (currentLeadId !== onlyLead.value) {
        setFormData((prev) => ({
          ...prev,
          lead: {
            id: onlyLead.value,
            name: onlyLead.label,
          },
        }));
      }
      setFormDataErrors((prev) => ({ ...prev, slot: undefined, leadId: undefined }));
      return;
    }

    const hasSelectedValidLead = options.some((option) => option.value === currentLeadId);
    if (!hasSelectedValidLead) {
      setFormData((prev) => ({ ...prev, lead: undefined }));
      setFormDataErrors((prev) => ({
        ...prev,
        slot: undefined,
        leadId: 'Multiple leads are available. Please choose a lead.',
      }));
      return;
    }
    setFormDataErrors((prev) => ({ ...prev, slot: undefined, leadId: undefined }));
  }, [selectedSlot, getLeadOptionsForSlot, formData.lead?.id]);

  const handleCancel = () => {
    setShowModal(false);
    setSelectedSlot(null);
    setTimeSlots([]);
    setFormDataErrors({});
  };

  const handleAppointmentUpdate = async () => {
    if (!allowReschedule(activeAppointment.status as any)) {
      notify('warning', {
        title: 'Reschedule blocked',
        text: 'Only requested and upcoming appointments can be rescheduled.',
      });
      setShowModal(false);
      return;
    }

    const errors: {
      leadId?: string;
      duration?: string;
      slot?: string;
    } = {};
    const slotLeadOptions = getLeadOptionsForSlot(selectedSlot);
    if (!formData.durationMinutes) errors.duration = 'Please select a duration';
    if (!selectedSlot) errors.slot = 'Please select a slot';
    if (selectedSlot && slotLeadOptions.length === 0) {
      errors.slot = 'No lead is available for this slot. Please choose another slot.';
      errors.leadId = 'No lead is available for this slot.';
    }
    if (selectedSlot && slotLeadOptions.length > 1 && !formData.lead?.id) {
      errors.leadId = 'Multiple leads are available. Please choose a lead.';
    }
    if (
      selectedSlot &&
      formData.lead?.id &&
      slotLeadOptions.length > 0 &&
      !slotLeadOptions.some((option) => option.value === formData.lead?.id)
    ) {
      errors.leadId = 'Selected lead is not available for this slot.';
    }
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      const payload: Appointment = { ...formData, status: activeAppointment.status };
      await updateAppointment(payload);
      setShowModal(false);
      setFormDataErrors({});
      setTimeSlots([]);
      setSelectedSlot(null);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    const appointmentTypeId = formData.appointmentType?.id;
    if (!appointmentTypeId || !selectedDate) {
      setTimeSlots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const slots = await getSlotsForServiceAndDateForPrimaryOrg(appointmentTypeId, selectedDate);
        if (cancelled) return;
        setTimeSlots(slots);
        setSelectedSlot(slots.length > 0 ? slots[0] : null);
      } catch (err) {
        console.log(err);
        if (!cancelled) {
          setTimeSlots([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.appointmentType?.id, selectedDate]);

  useEffect(() => {
    if (!showModal) return;
    if (allowReschedule(activeAppointment.status as any)) return;

    notify('warning', {
      title: 'Reschedule blocked',
      text: 'Checked-in, in-progress, completed, cancelled, and no-show appointments cannot be rescheduled.',
    });
    setShowModal(false);
  }, [activeAppointment.status, notify, setShowModal, showModal]);

  useEffect(() => {
    if (!selectedSlot || !selectedDate) return;
    setFormData((prev) => ({
      ...prev,
      startTime: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.startTime),
      endTime: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.endTime),
      appointmentDate: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.startTime),
      durationMinutes: getDurationMinutes(selectedSlot.startTime, selectedSlot.endTime),
    }));
  }, [selectedSlot, selectedDate]);

  const handleLeadSelect = (option: { label: string; value: string }) => {
    setFormData({
      ...formData,
      lead: {
        name: option.label,
        id: option.value,
      },
    });
    setFormDataErrors((prev) => ({ ...prev, leadId: undefined }));
  };

  return (
    <CenterModal showModal={showModal} setShowModal={setShowModal} onClose={handleCancel}>
      <div className="flex flex-col gap-3">
        <ModalHeader title="Reschedule" onClose={handleCancel} />
        <DateTimePickerSection
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          timeSlots={timeSlots}
          slotError={formDataErrors.slot}
          leadId={formData.lead?.id}
          leadError={formDataErrors.leadId}
          leadOptions={LeadOptions}
          onLeadSelect={handleLeadSelect}
          showSupportStaff={false}
        />
        <Primary href="#" text="Send request" onClick={handleAppointmentUpdate} />
      </div>
    </CenterModal>
  );
};

export default Reschedule;
