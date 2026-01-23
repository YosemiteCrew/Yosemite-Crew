import { formatUtcTimeToLocalLabel } from "@/app/components/Availability/utils";
import { Primary } from "@/app/components/Buttons";
import { getFormattedDate } from "@/app/components/Calendar/weekHelpers";
import Close from "@/app/components/Icons/Close";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Slotpicker from "@/app/components/Inputs/Slotpicker";
import CenterModal from "@/app/components/Modal/CenterModal";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from "@/app/services/appointmentService";
import { Slot } from "@/app/types/appointments";
import {
  buildUtcDateFromDateAndTime,
  getDurationMinutes,
} from "@/app/utils/date";
import { Appointment } from "@yosemite-crew/types";
import React, { useEffect, useMemo, useState } from "react";

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

  const handleAppointmentUpdate = async (values: any) => {
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
      const formData: Appointment = {
        ...activeAppointment,
        status: "REQUESTED",
      };
      await updateAppointment(formData);
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

  return (
    <CenterModal
      showModal={showModal}
      setShowModal={setShowModal}
      onClose={handleCancel}
    >
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Reschedule</div>
          </div>
          <Close onClick={handleCancel} />
        </div>
        <div className="flex flex-col gap-3">
          <Slotpicker
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedSlot={selectedSlot}
            setSelectedSlot={setSelectedSlot}
            timeSlots={timeSlots}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormInput
              intype="text"
              inname="date"
              value={getFormattedDate(selectedDate)}
              onChange={(e) => {}}
              inlabel="Date"
              className="min-h-12!"
            />
            <FormInput
              intype="text"
              inname="time"
              value={
                selectedSlot?.startTime
                  ? formatUtcTimeToLocalLabel(selectedSlot.startTime)
                  : ""
              }
              onChange={(e) => {}}
              error={formDataErrors.slot}
              inlabel="Time"
              className="min-h-12!"
            />
          </div>
          <LabelDropdown
            placeholder="Lead"
            onSelect={(option) =>
              setFormData({
                ...formData,
                lead: {
                  name: option.label,
                  id: option.value,
                },
              })
            }
            defaultOption={formData.lead?.id}
            error={formDataErrors.leadId}
            options={LeadOptions}
          />
        </div>
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
