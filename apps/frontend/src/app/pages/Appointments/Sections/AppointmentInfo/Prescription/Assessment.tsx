import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import React, { useMemo, useState } from "react";
import { Appointment, FormSubmission } from "@yosemite-crew/types";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import { FormsProps } from "@/app/types/forms";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import FormRenderer from "@/app/pages/Forms/Sections/AddForm/components/FormRenderer";
import { FormDataProps } from "..";
import AssessmentSubmissions from "./Submissions/AssessmentSubmissions";
import { createSubmission } from "@/app/services/soapService";
import { useAuthStore } from "@/app/stores/authStore";

type AssessmentProps = {
  activeAppointment: Appointment;
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
};

const Assessment = ({
  activeAppointment,
  formData,
  setFormData,
}: AssessmentProps) => {
  const attributes = useAuthStore.getState().attributes;
  const [query, setQuery] = useState("");
  const forms = useFormsForPrimaryOrgByCategory("SOAP-Assessment");
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

  const handleAssessmentSelect = (id: string) => {
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
        assessment: [created, ...(prev.assessment ?? [])],
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
      <Accordion
        title="Assessment (diagnosis)"
        defaultOpen
        showEditIcon={false}
        isEditing={true}
      >
        <div className="flex flex-col gap-3">
          <SearchDropdown
            placeholder="Search"
            options={FormOptions}
            onSelect={handleAssessmentSelect}
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
          <AssessmentSubmissions formData={formData} />
        </div>
      </Accordion>
      {active && (
        <Primary href="#" text="Save" classname="h-13!" onClick={handleSave} />
      )}
    </div>
  );
};

export default Assessment;
