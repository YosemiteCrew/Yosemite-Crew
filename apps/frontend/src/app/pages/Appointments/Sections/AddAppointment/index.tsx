import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import Modal from "@/app/components/Modal";
import React, { useEffect, useMemo, useState } from "react";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Slotpicker from "@/app/components/Inputs/Slotpicker";
import { getFormattedDate } from "@/app/components/Calendar/weekHelpers";
import { Appointment } from "@yosemite-crew/types";
import { useCompanionsParentsForPrimaryOrg } from "@/app/hooks/useCompanion";
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { useServiceStore } from "@/app/stores/serviceStore";
import {
  createAppointment,
  getSlotsForServiceAndDateForPrimaryOrg,
} from "@/app/services/appointmentService";
import { Slot } from "@/app/types/appointments";
import {
  buildUtcDateFromDateAndTime,
  getDurationMinutes,
} from "@/app/utils/date";
import { formatUtcTimeToLocalLabel } from "@/app/components/Availability/utils";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import Close from "@/app/components/Icons/Close";
import { useSubscriptionCounterUpdate } from "@/app/hooks/useStripeOnboarding";

type AddAppointmentProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

export const EMPTY_APPOINTMENT: Appointment = {
  id: undefined,
  companion: {
    id: "",
    name: "",
    species: "",
    breed: "",
    parent: {
      id: "",
      name: "",
    },
  },
  lead: undefined,
  supportStaff: [],
  room: undefined,
  appointmentType: undefined,
  organisationId: "",
  appointmentDate: new Date(),
  startTime: new Date(),
  endTime: new Date(),
  timeSlot: "",
  durationMinutes: 0,
  status: "REQUESTED",
  isEmergency: false,
  concern: "",
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

const AddAppointment = ({
  showModal,
  setShowModal,
}: AddAppointmentProps) => {
  const companions = useCompanionsParentsForPrimaryOrg();
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();
  const getServicesBySpecialityId =
    useServiceStore.getState().getServicesBySpecialityId;
  const [formData, setFormData] = useState<Appointment>(EMPTY_APPOINTMENT);
  const { refetch: refetchData } = useSubscriptionCounterUpdate();
  const [formDataErrors, setFormDataErrors] = useState<{
    companionId?: string;
    specialityId?: string;
    serviceId?: string;
    leadId?: string;
    duration?: string;
    slot?: string;
  }>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [query, setQuery] = useState("");
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

  const CompanionOptions = useMemo(
    () =>
      companions?.map((companion) => ({
        label: companion.companion.name,
        value: companion.companion.id,
      })),
    [companions]
  );

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

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId,
        value: team.practionerId,
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

  const CompanionInfoData = useMemo(
    () => ({
      name: formData.companion.name ?? "",
      species: formData.companion.species ?? "",
      breed: formData.companion.breed ?? "",
      parentName: formData.companion.parent.name ?? "",
    }),
    [formData.companion]
  );

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

  const handleCompanionSelect = (id: string) => {
    const selected = companions.find((item) => item.companion.id === id);
    if (!selected) return;
    setFormData((prev) => ({
      ...prev,
      companion: {
        id: selected.companion.id,
        name: selected.companion.name,
        species: selected.companion.type,
        breed: selected.companion.breed,
        parent: {
          id: selected.parent.id,
          name: selected.parent.firstName,
        },
      },
    }));
  };

  const handleCreate = async () => {
    const errors: {
      companionId?: string;
      specialityId?: string;
      serviceId?: string;
      leadId?: string;
      duration?: string;
      slot?: string;
    } = {};
    if (!formData.companion.id)
      errors.companionId = "Please select a companion";
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
      await refetchData()
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
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Add appointment</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
          <div className="flex flex-col gap-6 w-full">
            <Accordion
              title="Companion details"
              defaultOpen
              showEditIcon={false}
              isEditing={true}
            >
              <div className="flex flex-col gap-3">
                <SearchDropdown
                  placeholder="Search companion"
                  options={CompanionOptions}
                  onSelect={handleCompanionSelect}
                  query={query}
                  setQuery={setQuery}
                  minChars={0}
                  error={formDataErrors.companionId}
                />
                {formData.companion.name && (
                  <EditableAccordion
                    title={formData.companion.name}
                    fields={CompanionFields}
                    data={CompanionInfoData}
                    defaultOpen={true}
                    showEditIcon={false}
                  />
                )}
              </div>
            </Accordion>
            <Accordion
              title="Appointment details"
              showEditIcon={false}
              isEditing={true}
            >
              <div className="flex flex-col gap-3">
                <LabelDropdown
                  placeholder="Speciality"
                  onSelect={(option) =>
                    setFormData({
                      ...formData,
                      appointmentType: {
                        id: "",
                        name: "",
                        speciality: {
                          id: option.value,
                          name: option.label,
                        },
                      },
                    })
                  }
                  defaultOption={formData.appointmentType?.speciality.id}
                  error={formDataErrors.specialityId}
                  options={SpecialitiesOptions}
                />
                <LabelDropdown
                  placeholder="Service"
                  onSelect={(option) =>
                    setFormData({
                      ...formData,
                      appointmentType: {
                        id: option.value,
                        name: option.label,
                        speciality: formData.appointmentType?.speciality ?? {
                          id: "",
                          name: "",
                        },
                      },
                    })
                  }
                  defaultOption={formData.appointmentType?.id}
                  error={formDataErrors.serviceId}
                  options={ServicesOptions}
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
                    options={TeamOptions}
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
              <div className="text-body-4 text-text-primary">
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

export default AddAppointment;
