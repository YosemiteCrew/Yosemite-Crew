import Modal from "@/app/ui/overlays/Modal";
import React, { useEffect, useMemo } from "react";
import { CompanionParent } from "@/app/features/companions/pages/Companions/types";
import { EMPTY_APPOINTMENT } from "@/app/features/appointments/pages/Appointments/Sections/AddAppointment";
import Accordion from "@/app/ui/primitives/Accordion/Accordion";
import EditableAccordion from "@/app/ui/primitives/Accordion/EditableAccordion";
import { Primary } from "@/app/ui/primitives/Buttons";
import { useAppointmentForm } from "@/app/hooks/useAppointmentForm";
import ModalHeader from "@/app/ui/overlays/Modal/ModalHeader";
import AppointmentDetailsSection from "@/app/features/appointments/components/AppointmentDetailsSection";
import DateTimePickerSection from "@/app/features/appointments/components/DateTimePickerSection";
import BillableServicesSection from "@/app/features/appointments/components/BillableServicesSection";
import EmergencyCheckbox from "@/app/features/appointments/components/EmergencyCheckbox";
import BookingErrorMessage from "@/app/features/appointments/components/BookingErrorMessage";

type BookAppointmentProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeCompanion: CompanionParent;
};

const BookAppointment = ({
  showModal,
  setShowModal,
  activeCompanion,
}: BookAppointmentProps) => {
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
    resetForm,
  } = useAppointmentForm({
    onSuccess: () => setShowModal(false),
  });

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
  }, [showModal, activeCompanion, setFormData]);

  useEffect(() => {
    if (!showModal) {
      resetForm();
    }
  }, [showModal, resetForm]);

  const CompanionInfoData = useMemo(() => {
    return {
      name: activeCompanion.companion.name ?? "",
      species: activeCompanion.companion.type ?? "",
      breed: activeCompanion.companion.breed ?? "",
      parentName: activeCompanion.parent.firstName ?? "",
    };
  }, [activeCompanion]);

  const onSubmit = async () => {
    await handleCreate(false);
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <ModalHeader title="Add appointment" onClose={() => setShowModal(false)} />

        <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
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

export default BookAppointment;
