import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import React, { useMemo, useState } from "react";
import { Primary } from "@/app/components/Buttons";
import { FormDataProps } from "..";
import { Appointment, FormSubmission } from "@yosemite-crew/types";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import { FormsProps } from "@/app/types/forms";
import FormRenderer from "@/app/pages/Forms/Sections/AddForm/components/FormRenderer";
import { useAuthStore } from "@/app/stores/authStore";
import { createSubmission } from "@/app/services/soapService";
import PlanSubmissions from "./Submissions/PlanSubmissions";

type PlanProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
};

const Plan = ({ formData, setFormData, activeAppointment }: PlanProps) => {
  const attributes = useAuthStore.getState().attributes;
  const [planQuery, setPlanQuery] = useState("");
  const forms = useFormsForPrimaryOrgByCategory("SOAP-Plan");
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

  const handlePlanSelect = (id: string) => {
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
        plan: [created, ...(prev.plan ?? [])],
      }));
      setActive(null);
      setPlanQuery("");
      setValues(buildInitialValues([]));
    } catch (e) {
      console.error("Failed to save subjective submission:", e);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="font-grotesk font-medium text-black-text text-[23px]">
            Treatment/Plan
          </div>
          <SearchDropdown
            placeholder="Search plan"
            options={FormOptions}
            onSelect={handlePlanSelect}
            query={planQuery}
            setQuery={setPlanQuery}
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
          <PlanSubmissions formData={formData} />
        </div>
      </div>
      {active && (
        <Primary href="#" text="Save" classname="h-13!" onClick={handleSave} />
      )}
    </div>
  );
};

export default Plan;
