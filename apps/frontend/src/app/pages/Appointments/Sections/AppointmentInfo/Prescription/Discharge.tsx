import { Primary, Secondary } from "@/app/components/Buttons";
import React, { useMemo, useState } from "react";
import { FormDataProps } from "..";
import { Appointment, FormSubmission } from "@yosemite-crew/types";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import { FormsProps } from "@/app/types/forms";
import FormRenderer from "@/app/pages/Forms/Sections/AddForm/components/FormRenderer";
import { useAuthStore } from "@/app/stores/authStore";
import { createSubmission } from "@/app/services/soapService";
import DischargeSubmissions from "./Submissions/DischargeSubmissions";

type DischargeSummaryProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
};

const Discharge = ({
  activeAppointment,
  formData,
  setFormData,
}: DischargeSummaryProps) => {
  const attributes = useAuthStore.getState().attributes;
  const forms = useFormsForPrimaryOrgByCategory("Discharge");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<FormsProps | null>(null);
  const [values, setValues] = React.useState<Record<string, any>>(() =>
    buildInitialValues(active?.schema ?? [])
  );

  const FormOptions = useMemo(
    () =>
      forms?.map((form) => ({
        value: form._id || form.name,
        label: form.name,
      })),
    [forms]
  );

  const handleDischargeSelect = (id: string) => {
    const selected = forms.find((item) => item._id === id);
    if (!selected) return;
    const initialValues = buildInitialValues(selected.schema);
    setValues(initialValues);
    setActive(selected);
  };

  const handleValueChange = (id: string, value: any) => {
    setValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSave = async () => {
    if (!active?._id || !activeAppointment.id || !attributes) return;
    try {
      const submission: FormSubmission = {
        _id: "",
        formVersion: 1,
        submittedAt: new Date(),
        formId: active._id,
        appointmentId: activeAppointment.id,
        companionId: activeAppointment?.companion?.id ?? "",
        parentId: activeAppointment?.companion?.parent?.id ?? "",
        answers: values,
        submittedBy: attributes.sub,
      };
      const created = await createSubmission(submission);
      setFormData((prev) => ({
        ...prev,
        discharge: [created, ...(prev.discharge ?? [])],
      }));
      setActive(null);
      setQuery("");
      setValues(buildInitialValues([]));
    } catch (e) {
      console.error("Failed to save subjective submission:", e);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
      <div className="flex flex-col gap-6">
        <div className="font-grotesk font-medium text-black-text text-[23px]">
          Discharge summary
        </div>
        <div className="flex flex-col gap-3">
          <SearchDropdown
            placeholder="Search"
            options={FormOptions}
            onSelect={handleDischargeSelect}
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
          <DischargeSubmissions formData={formData} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {active && (
          <Secondary
            href="#"
            text="Save"
            className="h-13!"
            onClick={handleSave}
          />
        )}
        <Primary
          href="#"
          text="Share with parents"
          classname="h-13!"
          onClick={() => {}}
        />
      </div>
    </div>
  );
};

export default Discharge;
