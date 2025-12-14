import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import React, { useMemo, useState } from "react";
import { Appointment } from "@yosemite-crew/types";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import { FormsProps } from "@/app/types/forms";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import FormRenderer from "@/app/pages/Forms/Sections/AddForm/components/FormRenderer";
import { FormDataProps } from "..";

type ObjectiveProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
};

const Objective = ({
  activeAppointment,
  formData,
  setFormData,
}: ObjectiveProps) => {
  const [query, setQuery] = useState("");
  const forms = useFormsForPrimaryOrgByCategory("SOAP-Objective");
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

  const handleObjectiveSelect = (id: string) => {
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
        title="Objective (clinical examination)"
        defaultOpen
        showEditIcon={false}
        isEditing={true}
      >
        <div className="flex flex-col gap-3">
          <SearchDropdown
            placeholder="Search"
            options={FormOptions}
            onSelect={handleObjectiveSelect}
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

export default Objective;
