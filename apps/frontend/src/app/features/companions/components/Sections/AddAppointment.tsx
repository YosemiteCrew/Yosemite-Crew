import React, { useState } from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import Dropdown from '@/app/ui/inputs/Dropdown/Dropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import { Primary } from '@/app/ui/primitives/Buttons';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import {
  LeadOptions,
  SpecialityOptions,
  SupportOptions,
} from '@/app/features/companions/components/Sections/AddAppointmentOptions';

type FormDataType = {
  speciality: string;
  service: string;
  concern: string;
  lead: string;
  support: string[];
};

const AddAppointment = () => {
  const [formData, setFormData] = useState<FormDataType>({
    speciality: '',
    service: '',
    concern: '',
    lead: '',
    support: [],
  });
  const [formDataErrors] = useState<{
    speciality?: string;
    service?: string;
    lead?: string;
  }>({});

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--ink)]">
        New appointment
      </h2>
      <Accordion title="Appointment details" defaultOpen showEditIcon={false} isEditing={true}>
        <div className="flex flex-col gap-3">
          <Dropdown
            placeholder="Speciality"
            value={formData.speciality}
            onChange={(e) => setFormData({ ...formData, speciality: e })}
            error={formDataErrors.speciality}
            options={SpecialityOptions}
            dropdownClassName="h-fit!"
          />
          <Dropdown
            placeholder="Service"
            value={formData.service}
            onChange={(e) => setFormData({ ...formData, service: e })}
            error={formDataErrors.service}
            options={SpecialityOptions}
            dropdownClassName="h-fit!"
          />
          <FormDesc
            intype="text"
            inname="Describe concern"
            value={formData.concern}
            inlabel="Describe concern"
            onChange={(e) => setFormData({ ...formData, concern: e.target.value })}
            className="min-h-[120px]!"
          />
        </div>
      </Accordion>
      <Accordion title="Select date & time" showEditIcon={false} isEditing={true}>
        <div className="flex flex-col gap-3"></div>
      </Accordion>
      <Accordion title="Staff details" showEditIcon={false} isEditing={true}>
        <div className="flex flex-col gap-3">
          <Dropdown
            placeholder="Lead"
            value={formData.lead}
            onChange={(e) => setFormData({ ...formData, lead: e })}
            error={formDataErrors.lead}
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
      <Accordion title="Billable services" showEditIcon={false} isEditing={true}>
        <div className="flex flex-col gap-3"></div>
      </Accordion>
      <Primary href="#" text="Book appointment" />
    </div>
  );
};

export default AddAppointment;
