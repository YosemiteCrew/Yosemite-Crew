import React from "react";
import Accordion from "@/app/ui/primitives/Accordion/Accordion";
import LabelDropdown from "@/app/ui/inputs/Dropdown/LabelDropdown";
import FormDesc from "@/app/ui/inputs/FormDesc/FormDesc";

type Option = { label: string; value: string };

type AppointmentDetailsSectionProps = {
  specialityId?: string;
  specialityError?: string;
  specialitiesOptions: Option[];
  onSpecialitySelect: (option: Option) => void;
  serviceId?: string;
  serviceError?: string;
  servicesOptions: Option[];
  onServiceSelect: (option: Option) => void;
  concern: string;
  onConcernChange: (value: string) => void;
};

const AppointmentDetailsSection = ({
  specialityId,
  specialityError,
  specialitiesOptions,
  onSpecialitySelect,
  serviceId,
  serviceError,
  servicesOptions,
  onServiceSelect,
  concern,
  onConcernChange,
}: AppointmentDetailsSectionProps) => (
  <Accordion
    title="Appointment details"
    showEditIcon={false}
    isEditing={true}
  >
    <div className="flex flex-col gap-3">
      <LabelDropdown
        placeholder="Speciality"
        onSelect={onSpecialitySelect}
        defaultOption={specialityId}
        error={specialityError}
        options={specialitiesOptions}
      />
      <LabelDropdown
        placeholder="Service"
        onSelect={onServiceSelect}
        defaultOption={serviceId}
        error={serviceError}
        options={servicesOptions}
      />
      <FormDesc
        intype="text"
        inname="Describe concern"
        value={concern}
        inlabel="Describe concern"
        onChange={(e) => onConcernChange(e.target.value)}
        className="min-h-[120px]!"
      />
    </div>
  </Accordion>
);

export default AppointmentDetailsSection;
