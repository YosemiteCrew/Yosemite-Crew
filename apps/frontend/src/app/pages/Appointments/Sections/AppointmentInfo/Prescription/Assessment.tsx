import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import React, { useState } from "react";
import { DemoSubjectiveOptions } from "./demo";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { formDataProps } from "..";
import { AppointmentsProps } from "@/app/types/appointments";

type AssessmentProps = {
  formData: formDataProps;
  setFormData: React.Dispatch<React.SetStateAction<formDataProps>>;
  activeAppointment: AppointmentsProps;
};

const Assessment = ({
  formData,
  setFormData,
  activeAppointment,
}: AssessmentProps) => {
  const [query, setQuery] = useState("");
  const [formDataErrors] = useState<{
    prognosis?: string;
  }>({});

  const handleAssessmentSelect = (id: string) => {};

  const handleSave = () => {};

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <Accordion
        title="Assessment (diagnosis)"
        defaultOpen
        showEditIcon={false}
        isEditing={true}
      >
        <div className="flex flex-col gap-3">
          <SearchDropdown
            placeholder="Search"
            options={DemoSubjectiveOptions}
            onSelect={handleAssessmentSelect}
            query={query}
            setQuery={setQuery}
          />
          <FormInput
            intype="text"
            inname="tentative"
            value={formData.tentatve}
            inlabel="Tentative diagnosis"
            onChange={(e) =>
              setFormData({ ...formData, tentatve: e.target.value })
            }
            className="min-h-12!"
          />
          <FormDesc
            intype="text"
            inname="differential"
            value={formData.differential}
            inlabel="Differential diagnosis"
            onChange={(e) =>
              setFormData({ ...formData, differential: e.target.value })
            }
            className="min-h-[120px]!"
          />
          <FormInput
            intype="text"
            inname="prognosis"
            value={formData.prognosis}
            inlabel="Prognosis"
            onChange={(e) =>
              setFormData({ ...formData, prognosis: e.target.value })
            }
            error={formDataErrors.prognosis}
            className="min-h-12!"
          />
        </div>
      </Accordion>
      <Primary href="#" text="Save" classname="h-13!" onClick={handleSave} />
    </div>
  );
};

export default Assessment;
