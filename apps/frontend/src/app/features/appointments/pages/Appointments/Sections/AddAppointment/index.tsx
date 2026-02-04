import Accordion from "@/app/ui/primitives/Accordion/Accordion";
import { Primary, Secondary } from "@/app/ui/primitives/Buttons";
import SearchDropdown from "@/app/ui/inputs/SearchDropdown";
import Modal from "@/app/ui/overlays/Modal";
import React, { useMemo, useState } from "react";
import { Appointment } from "@yosemite-crew/types";
import { useCompanionsParentsForPrimaryOrg } from "@/app/hooks/useCompanion";
import EditableAccordion from "@/app/ui/primitives/Accordion/EditableAccordion";
import { useAppointmentForm } from "@/app/hooks/useAppointmentForm";
import ModalHeader from "@/app/ui/overlays/Modal/ModalHeader";
import AppointmentDetailsSection from "@/app/features/appointments/components/AppointmentDetailsSection";
import DateTimePickerSection from "@/app/features/appointments/components/DateTimePickerSection";
import BillableServicesSection from "@/app/features/appointments/components/BillableServicesSection";
import EmergencyCheckbox from "@/app/features/appointments/components/EmergencyCheckbox";
import BookingErrorMessage from "@/app/features/appointments/components/BookingErrorMessage";

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
        <ModalHeader title="Add appointment" onClose={() => setShowModal(false)} />

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
            <AppointmentDetailsSection
              specialityId={formData.appointmentType?.speciality.id}
              specialityError={formDataErrors.specialityId}
              specialitiesOptions={SpecialitiesOptions}
              onSpecialitySelect={handleSpecialitySelect}
              serviceId={formData.appointmentType?.id}
              serviceError={formDataErrors.serviceId}
              servicesOptions={ServicesOptions}
              onServiceSelect={handleServiceSelect}
              concern={formData.concern || ""}
              onConcernChange={(value) =>
                setFormData({ ...formData, concern: value })
              }
            />
            <Accordion
              title="Select date & time"
              showEditIcon={false}
              isEditing={true}
            >
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
                supportStaffIds={formData.supportStaff?.map((s) => s.id) || []}
                teamOptions={TeamOptions}
                onSupportStaffChange={handleSupportStaffChange}
              />
            </Accordion>
            <BillableServicesSection
              serviceId={formData.appointmentType?.id}
              serviceName={formData.appointmentType?.name}
              serviceFields={ServiceFields}
              serviceInfoData={ServiceInfoData}
            />
            <EmergencyCheckbox
              checked={formData.isEmergency ?? false}
              onChange={(checked) =>
                setFormData((prev) => ({ ...prev, isEmergency: checked }))
              }
            />
          </div>
          <div className="flex flex-col items-end gap-2 w-full">
            <BookingErrorMessage error={formDataErrors.booking} />
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
