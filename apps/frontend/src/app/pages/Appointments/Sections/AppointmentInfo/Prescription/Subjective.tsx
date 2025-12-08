import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import React, { useState } from "react";
import { DemoSubjective, DemoSubjectiveOptions } from "./demo";
import { formDataProps } from "..";
import { AppointmentsProps } from "@/app/types/appointments";

type SubjectiveProps = {
  formData: formDataProps;
  setFormData: React.Dispatch<React.SetStateAction<formDataProps>>;
  activeAppointment: AppointmentsProps;
};

const Subjective = ({
  formData,
  setFormData,
  activeAppointment,
}: SubjectiveProps) => {
  const [formDataErrors] = useState<{
    desc?: string;
  }>({});

  const handleSubjectiveSelect = (id: string) => {
    const selected = DemoSubjective.find((item) => item.id === id);
    if (!selected) return;
    setFormData((prev: any) => ({
      ...prev,
      desc: selected.description,
    }));
  };

  const handleSave = () => {
    if (!formData.desc) {
      formDataErrors.desc = "Subjective description is required";
    }
    if (Object.keys(formData).length > 0) {
      return;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <Accordion
        title="Subjective (history)"
        defaultOpen
        showEditIcon={false}
        isEditing={true}
      >
        <div className="flex flex-col gap-3">
          <SearchDropdown
            placeholder="Search"
            options={DemoSubjectiveOptions}
            onSelect={handleSubjectiveSelect}
          />
          <FormDesc
            intype="text"
            inname="desc"
            value={formData.desc}
            inlabel="Description"
            onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
            error={formDataErrors.desc}
            className="min-h-[120px]!"
          />
        </div>
      </Accordion>
      <Primary href="#" text="Save" classname="h-13!" onClick={handleSave} />
    </div>
  );
};

export default Subjective;
