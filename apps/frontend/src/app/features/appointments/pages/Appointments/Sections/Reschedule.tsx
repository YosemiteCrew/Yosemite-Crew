import { Primary } from "@/app/ui/primitives/Buttons";
import CenterModal from "@/app/ui/overlays/Modal/CenterModal";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from "@/app/features/appointments/services/appointmentService";
import { Slot } from "@/app/features/appointments/types/appointments";
import {
  buildUtcDateFromDateAndTime,
  getDurationMinutes,
} from "@/app/lib/date";
import { Appointment } from "@yosemite-crew/types";
import React, { useEffect, useMemo, useState } from "react";
import ModalHeader from "@/app/ui/overlays/Modal/ModalHeader";
import DateTimePickerSection from "@/app/features/appointments/components/DateTimePickerSection";

type RescheduleProp = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment;
};

const Reschedule = ({
  showModal,
  setShowModal,
  activeAppointment,
}: RescheduleProp) => {
  const teams = useTeamForPrimaryOrg();
  const [formData, setFormData] = useState<Appointment>(activeAppointment);
  const [selectedDate, setSelectedDate] = useState<Date>(
    activeAppointment.appointmentDate
  );
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [timeSlots, setTimeSlots] = useState<Slot[]>([]);
  const [formDataErrors, setFormDataErrors] = useState<{
    leadId?: string;
    duration?: string;
    slot?: string;
  }>({});

  useEffect(() => {
    if (activeAppointment) {
      setFormData(activeAppointment);
      setSelectedDate(activeAppointment.appointmentDate);
    }
  }, [activeAppointment]);

  const LeadOptions = useMemo(() => {
    if (!teams?.length || !selectedSlot) return [];
    const slot = timeSlots.find((s) => s.startTime === selectedSlot.startTime);
    if (!slot?.vetIds?.length) return [];
    const vetIdSet = new Set(slot.vetIds);
    return teams
      .filter((team) => vetIdSet.has(team.practionerId))
      .map((team) => ({
        label: team.name || team.practionerId,
        value: team.practionerId,
      }));
  }, [teams, timeSlots, selectedSlot]);

  const handleCancel = () => {
    setShowModal(false);
    setSelectedSlot(null);
    setTimeSlots([]);
    setFormDataErrors({});
  };

  const handleAppointmentUpdate = async () => {
    const errors: {
      leadId?: string;
      duration?: string;
      slot?: string;
    } = {};
    if (!formData.lead?.id) errors.leadId = "Please select a lead";
    if (!formData.durationMinutes) errors.duration = "Please select a duration";
    if (!selectedSlot) errors.slot = "Please select a slot";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      const payload: Appointment = {
        ...activeAppointment,
        status: "REQUESTED",
      };
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
        const slots = await getSlotsForServiceAndDateForPrimaryOrg(
          appointmentTypeId,
          selectedDate
        );
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
    if (!selectedSlot || !selectedDate) return;
    setFormData((prev) => ({
      ...prev,
      startTime: buildUtcDateFromDateAndTime(
        selectedDate,
        selectedSlot.startTime
      ),
      endTime: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.endTime),
      appointmentDate: buildUtcDateFromDateAndTime(
        selectedDate,
        selectedSlot.startTime
      ),
      durationMinutes: getDurationMinutes(
        selectedSlot.startTime,
        selectedSlot.endTime
      ),
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
  };

  return (
    <CenterModal
      showModal={showModal}
      setShowModal={setShowModal}
      onClose={handleCancel}
    >
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
        <Primary
          href="#"
          text="Send request"
          onClick={handleAppointmentUpdate}
        />
      </div>
    </CenterModal>
  );
};

export default Reschedule;
