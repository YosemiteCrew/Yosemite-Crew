import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import React, { useMemo, useState } from "react";
import { Appointment } from "@yosemite-crew/types";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import { FormsProps } from "@/app/types/forms";
import FormRenderer from "@/app/pages/Forms/Sections/AddForm/components/FormRenderer";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import { FormDataProps } from "..";

type SubjectiveProps = {
  activeAppointment: Appointment;
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
};

const Subjective = ({
  activeAppointment,
  formData,
  setFormData,
}: SubjectiveProps) => {
  const [query, setQuery] = useState("");
  const forms = useFormsForPrimaryOrgByCategory("SOAP-Subjective");
  const [active, setActive] = useState<FormsProps | null>(null);
  const [values, setValues] = React.useState<Record<string, any>>(() =>
    buildInitialValues(active?.schema ?? [])
  );

  const FormOptions = useMemo(
    () =>
      forms?.map((form) => ({
        key: form._id || form.name,
        value: form.name,
      })),
    [forms]
  );

  const handleSubjectiveSelect = (id: string) => {
    const selected = forms.find((item) => item._id === id);
    if (!selected) return;
    setActive(selected);
  };

  const handleValueChange = (id: string, value: any) => {
    setValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSave = () => {};

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <Accordion
        title="Subjective (history)"
        defaultOpen
        showEditIcon={false}
        isEditing={true}
      >
        <div className="flex flex-col gap-4">
          <SearchDropdown
            placeholder="Search"
            options={FormOptions}
            onSelect={handleSubjectiveSelect}
            query={query}
            setQuery={setQuery}
            minChars={0}
          />
          {active && (
            <FormRenderer
              fields={active.schema ?? []}
              values={values}
              onChange={handleValueChange}
              readOnly
            />
          )}
        </div>
      </Accordion>
      <Primary href="#" text="Save" classname="h-13!" onClick={handleSave} />
    </div>
  );
};

export default Subjective;
