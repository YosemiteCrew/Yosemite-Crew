import React, { useState } from "react";
import Accordion from "../../Accordion/Accordion";
import Dropdown from "../../Inputs/Dropdown/Dropdown";
import FormDesc from "../../Inputs/FormDesc/FormDesc";
import { Primary } from "../../Buttons";
import MultiSelectDropdown from "../../Inputs/MultiSelectDropdown";

export const SpecialityOptions: string[] = [
  "Internal medicine",
  "Surgery",
  "Dermatology",
];
export const LeadOptions: string[] = [
  "Dr. Emily brown",
  "Dr. Drake ramoray",
  "Dr. Philip philips",
];
export const SupportOptions: string[] = [
  "Dr. Emily brown",
  "Dr. Drake ramoray",
  "Dr. Philip philips",
];

type FormDataType = {
  speciality: string;
  service: string;
  concern: string;
  lead: string;
  support: string[];
};

const AddAppointment = () => {
  const [formData, setFormData] = useState<FormDataType>({
    speciality: "",
    service: "",
    concern: "",
    lead: "",
    support: [],
  });
  const [formDataErrors] = useState<{
    speciality?: string;
    service?: string;
    lead?: string;
  }>({});

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="font-grotesk text-black-text text-[23px] font-medium">
        Add appointment
      </div>
      <Accordion
        title="Appointment details"
        defaultOpen
        showEditIcon={false}
        isEditing={true}
      >
        <div className="flex flex-col gap-3">
          <Dropdown
            placeholder="Speciality"
            value={formData.speciality}
            onChange={(e) => setFormData({ ...formData, speciality: e })}
            error={formDataErrors.speciality}
            className="min-h-12!"
            options={SpecialityOptions}
            dropdownClassName="h-fit!"
          />
          <Dropdown
            placeholder="Service"
            value={formData.service}
            onChange={(e) => setFormData({ ...formData, service: e })}
            error={formDataErrors.service}
            className="min-h-12!"
            options={SpecialityOptions}
            dropdownClassName="h-fit!"
          />
          <FormDesc
            intype="text"
            inname="Describe concern"
            value={formData.concern}
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
        <div className="flex flex-col gap-3"></div>
      </Accordion>
      <Accordion title="Staff details" showEditIcon={false} isEditing={true}>
        <div className="flex flex-col gap-3">
          <Dropdown
            placeholder="Lead"
            value={formData.lead}
            onChange={(e) => setFormData({ ...formData, lead: e })}
            error={formDataErrors.lead}
            className="min-h-12!"
            options={LeadOptions}
            dropdownClassName="h-fit!"
          />
          <MultiSelectDropdown
            placeholder="Support"
            value={formData.support}
            onChange={(e) => setFormData({ ...formData, support: e })}
            error={formDataErrors.lead}
            options={SupportOptions}
          />
        </div>
      </Accordion>
      <Accordion
        title="Billable services"
        showEditIcon={false}
        isEditing={true}
      >
        <div className="flex flex-col gap-3"></div>
      </Accordion>
      <Primary href="#" text="Book appointment" classname="h-13!" />
    </div>
  );
};

export default AddAppointment;
