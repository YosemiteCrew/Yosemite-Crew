import Modal from "@/app/components/Modal";
import React, { useEffect, useMemo, useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { CompanionParent } from "./types";
import { EMPTY_APPOINTMENT } from "../Appointments/Sections/AddAppointment";
import { Appointment } from "@yosemite-crew/types";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { useServiceStore } from "@/app/stores/serviceStore";
import { Slot } from "@/app/types/appointments";
import {
  createAppointment,
  getSlotsForServiceAndDateForPrimaryOrg,
} from "@/app/services/appointmentService";
import {
  buildUtcDateFromDateAndTime,
  getDurationMinutes,
} from "@/app/utils/date";
import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { getFormattedDate } from "@/app/components/Calendar/weekHelpers";
import { formatUtcTimeToLocalLabel } from "@/app/components/Availability/utils";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import Slotpicker from "@/app/components/Inputs/Slotpicker";
import { Primary } from "@/app/components/Buttons";

type BookAppointmentProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeCompanion: CompanionParent;
};

const CompanionFields = [
  { label: "Name", key: "name", type: "text" },
  { label: "Parent name", key: "parentName", type: "text" },
  { label: "Breed", key: "breed", type: "text" },
  { label: "Species", key: "species", type: "text" },
];

const ServiceFields = [
  { label: "Name", key: "name", type: "text" },
  { label: "Description", key: "description", type: "text" },
  { label: "Duration (mins)", key: "duration", type: "text" },
  { label: "Cost ($)", key: "cost", type: "text" },
  { label: "Max discount", key: "maxDiscount", type: "text" },
];

const BookAppointment = ({
  showModal,
  setShowModal,
  activeCompanion,
}: BookAppointmentProps) => {
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();
  const getServicesBySpecialityId =
    useServiceStore.getState().getServicesBySpecialityId;
  const [formData, setFormData] = useState<Appointment>(EMPTY_APPOINTMENT);
  const [formDataErrors, setFormDataErrors] = useState<{
    specialityId?: string;
    serviceId?: string;
    leadId?: string;
    duration?: string;
    slot?: string;
  }>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [timeSlots, setTimeSlots] = useState<Slot[]>([]);

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

  const LeadOptions = useMemo(() => {
    if (!teams?.length || !selectedSlot) return [];
    const slot = timeSlots.find((s) => s.startTime === selectedSlot.startTime);
    if (!slot?.vetIds?.length) return [];
    const vetIdSet = new Set(slot.vetIds);
    return teams
      .filter((team) => vetIdSet.has(team._id))
      .map((team) => ({
        label: team.name || team._id,
        value: team._id,
      }));
  }, [teams, timeSlots, selectedSlot]);

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team._id,
        value: team._id,
      })),
    [teams]
  );

  const SpecialitiesOptions = useMemo(
    () =>
      specialities?.map((speciality) => ({
        label: speciality.name,
        value: speciality._id || speciality.name,
      })),
    [specialities]
  );

  const services = useMemo(() => {
    const specialityId = formData.appointmentType?.speciality.id;
    if (!specialityId) {
      return [];
    }
    return getServicesBySpecialityId(specialityId);
  }, [formData.appointmentType?.speciality]);

  const ServicesOptions = useMemo(
    () =>
      services?.map((service) => ({
        label: service.name,
        value: service.id,
      })),
    [services]
  );

  useEffect(() => {
    if (!showModal) return;
    setFormData({
      ...EMPTY_APPOINTMENT,
      companion: {
        name: activeCompanion.companion.name,
        id: activeCompanion.companion.id,
        species: activeCompanion.companion.type,
        breed: activeCompanion.companion.breed,
        parent: {
          id: activeCompanion.parent.id,
          name: activeCompanion.parent.firstName,
        },
      },
    });
    setFormDataErrors({});
  }, [showModal, activeCompanion]);

  const CompanionInfoData = useMemo(() => {
    return {
      name: activeCompanion.companion.name ?? "",
      species: activeCompanion.companion.type ?? "",
      breed: activeCompanion.companion.breed ?? "",
      parentName: activeCompanion.parent.firstName ?? "",
    };
  }, [activeCompanion]);

  const ServiceInfoData = useMemo(() => {
    const serviceId = formData.appointmentType?.id;
    if (!serviceId) {
      return {
        name: "",
        description: "",
        cost: "",
        maxDiscount: "",
        duration: "",
      };
    }
    const service = services.filter((s) => s.id === serviceId);
    if (service && service.length > 0) {
      return {
        name: service[0].name ?? "",
        description: service[0].description ?? "",
        cost: service[0].cost ?? "",
        maxDiscount: service[0].maxDiscount ?? "",
        duration: service[0].durationMinutes ?? "",
      };
    } else {
      return {
        name: "",
        description: "",
        cost: "",
        maxDiscount: "",
        duration: "",
      };
    }
  }, [formData.appointmentType]);

  const handleCreate = async () => {
    console.log(formData);
    const errors: {
      specialityId?: string;
      serviceId?: string;
      leadId?: string;
      slot?: string;
      duration?: string;
    } = {};
    if (!formData.appointmentType?.speciality.id)
      errors.specialityId = "Please select a speciality";
    if (!formData.appointmentType?.id)
      errors.serviceId = "Please select a service";
    if (!formData.lead?.id) errors.leadId = "Please select a lead";
    if (!formData.durationMinutes) errors.duration = "Please select a duration";
    if (!selectedSlot) errors.slot = "Please select a slot";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await createAppointment(formData);
      setShowModal(false);
      setFormData(EMPTY_APPOINTMENT);
      setSelectedSlot(null);
      setFormDataErrors({});
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex items-center justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            Add appointment
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
          <div className="flex flex-col gap-6 w-full">
            {formData.companion.name && (
              <EditableAccordion
                title={formData.companion.name}
                fields={CompanionFields}
                data={CompanionInfoData}
                defaultOpen={true}
                showEditIcon={false}
              />
            )}
            <Accordion
              title="Appointment details"
              showEditIcon={false}
              isEditing={true}
            >
              <div className="flex flex-col gap-3">
                <Dropdown
                  placeholder="Speciality"
                  value={formData.appointmentType?.speciality.id || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      appointmentType: {
                        id: "",
                        name: "",
                        speciality: {
                          id: e.value,
                          name: e.label,
                        },
                      },
                    })
                  }
                  error={formDataErrors.specialityId}
                  className="min-h-12!"
                  options={SpecialitiesOptions}
                  dropdownClassName="h-fit! max-h-[150px]!"
                  returnObject
                />
                <Dropdown
                  placeholder="Service"
                  value={formData.appointmentType?.id || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      appointmentType: {
                        id: e.value,
                        name: e.label,
                        speciality: formData.appointmentType?.speciality ?? {
                          id: "",
                          name: "",
                        },
                      },
                    })
                  }
                  error={formDataErrors.serviceId}
                  className="min-h-12!"
                  options={ServicesOptions}
                  dropdownClassName="h-fit! max-h-[150px]!"
                  returnObject
                />
                <FormDesc
                  intype="text"
                  inname="Describe concern"
                  value={formData.concern || ""}
                  inlabel="Describe concern"
                  onChange={(e) =>
                    setFormData({ ...formData, concern: e.target.value })
                  }
                  className="min-h-[120px]!"
                />
              </div>
            </Accordion>
            <Accordion
              title="Select date & time"
              showEditIcon={false}
              isEditing={true}
            >
              <div className="flex flex-col gap-4">
                <Slotpicker
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  selectedSlot={selectedSlot}
                  setSelectedSlot={setSelectedSlot}
                  timeSlots={timeSlots}
                />
                <div className="flex flex-col gap-3">
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
                      error={formDataErrors.slot}
                      onChange={(e) => {}}
                      inlabel="Time"
                      className="min-h-12!"
                    />
                  </div>
                  <Dropdown
                    placeholder="Lead"
                    value={formData.lead?.id || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lead: {
                          name: e.label,
                          id: e.value,
                        },
                      })
                    }
                    error={formDataErrors.leadId}
                    className="min-h-12!"
                    options={LeadOptions}
                    dropdownClassName="h-fit! max-h-[150px]!"
                    returnObject
                  />
                  <MultiSelectDropdown
                    placeholder="Support"
                    value={formData.supportStaff?.map((s) => s.id) || []}
                    onChange={(ids) => {
                      const map = new Map(
                        TeamOptions.map((o) =>
                          typeof o === "string" ? [o, o] : [o.value, o.label]
                        )
                      );
                      setFormData({
                        ...formData,
                        supportStaff: ids.map((id) => ({
                          id,
                          name: map.get(id) || "",
                        })),
                      });
                    }}
                    className="min-h-12!"
                    options={TeamOptions}
                    dropdownClassName="h-fit! max-h-[150px]!"
                  />
                </div>
              </div>
            </Accordion>
            <Accordion
              title="Billable services"
              showEditIcon={false}
              isEditing={true}
            >
              {formData.appointmentType?.id && (
                <EditableAccordion
                  title={formData.appointmentType.name}
                  fields={ServiceFields}
                  data={ServiceInfoData}
                  defaultOpen={true}
                  showEditIcon={false}
                />
              )}
            </Accordion>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isEmergency}
                onChange={() =>
                  setFormData((prev) => ({
                    ...prev,
                    isEmergency: !prev.isEmergency,
                  }))
                }
              />
              <div className="font-satoshi text-black-text text-[16px] font-semibold">
                I confirm this is an emergency.
              </div>
            </div>
          </div>
          <Primary
            href="#"
            text="Book appointment"
            classname="h-13!"
            onClick={handleCreate}
          />
        </div>
      </div>
    </Modal>
  );
};

export default BookAppointment;
