import Accordion from "@/app/components/Accordion/Accordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import Modal from "@/app/components/Modal";
import React, { useMemo, useState } from "react";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Slotpicker from "@/app/components/Inputs/Slotpicker";
import { getFormattedDate } from "@/app/components/Calendar/weekHelpers";
import { Appointment } from "@yosemite-crew/types";
import { useCompanionsParentsForPrimaryOrg } from "@/app/hooks/useCompanion";
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { formatUtcTimeToLocalLabel } from "@/app/components/Availability/utils";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import Close from "@/app/components/Icons/Close";
import { IoIosWarning } from "react-icons/io";
import { useAppointmentForm } from "@/app/hooks/useAppointmentForm";

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

const AddAppointment = ({ showModal, setShowModal }: AddAppointmentProps) => {
  const companions = useCompanionsParentsForPrimaryOrg();
  const [query, setQuery] = useState("");

  const {
    formData,
    setFormData,
    formDataErrors,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    timeSlots,
    ServiceFields,
    CompanionFields,
    LeadOptions,
    TeamOptions,
    SpecialitiesOptions,
    ServicesOptions,
    ServiceInfoData,
    handleCreate,
    handleSpecialitySelect,
    handleServiceSelect,
    handleLeadSelect,
    handleSupportStaffChange,
  } = useAppointmentForm({
    onSuccess: () => setShowModal(false),
  });

  const CompanionOptions = useMemo(
    () =>
      companions?.map((companion) => ({
        label: companion.companion.name,
        value: companion.companion.id,
      })),
    [companions],
  );

  const CompanionInfoData = useMemo(
    () => ({
      name: formData.companion.name ?? "",
      species: formData.companion.species ?? "",
      breed: formData.companion.breed ?? "",
      parentName: formData.companion.parent.name ?? "",
    }),
    [formData.companion],
  );

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

  const onSubmit = async () => {
    await handleCreate(true);
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
                {CompanionOptions.length > 0 ? (
                  <>
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
                  </>
                ) : (
                  <div className="flex gap-2 flex-col items-center pb-2">
                    <div className="text-body-4 text-text-primary">
                      You need companions to start booking appointments
                    </div>
                    <Secondary
                      text="Add companions"
                      href="/companions"
                      className="w-full"
                    />
                  </div>
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
                  onSelect={handleSpecialitySelect}
                  defaultOption={formData.appointmentType?.speciality.id}
                  error={formDataErrors.specialityId}
                  options={SpecialitiesOptions}
                />
                <LabelDropdown
                  placeholder="Service"
                  onSelect={handleServiceSelect}
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
                    onSelect={handleLeadSelect}
                    defaultOption={formData.lead?.id}
                    error={formDataErrors.leadId}
                    options={LeadOptions}
                  />
                  <MultiSelectDropdown
                    placeholder="Support"
                    value={formData.supportStaff?.map((s) => s.id) || []}
                    onChange={handleSupportStaffChange}
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
          <div className="flex flex-col items-end gap-2 w-full">
            {formDataErrors.booking && (
              <div className="mt-1.5 flex items-center gap-1 px-2 text-caption-2 text-text-error">
                <IoIosWarning className="text-text-error" size={14} />
                <span>{formDataErrors.booking}</span>
              </div>
            )}
            <Primary
              href="#"
              text="Book appointment"
              onClick={onSubmit}
              classname="w-full"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddAppointment;
