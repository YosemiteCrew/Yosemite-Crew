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
import { createSubmission } from "@/app/services/soapService";
import { useAuthStore } from "@/app/stores/authStore";
import ObjectiveSubmissions from "./Submissions/ObjectiveSubmissions";
import { PERMISSIONS } from "@/app/utils/permissions";
import { PermissionGate } from "@/app/components/PermissionGate";
import Fallback from "@/app/components/Fallback";
import { hasSignatureField } from "./signatureUtils";

type ObjectiveProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
  canEdit: boolean;
};

const Objective = ({
  activeAppointment,
  formData,
  setFormData,
  canEdit,
}: ObjectiveProps) => {
  const attributes = useAuthStore.getState().attributes;
  const [query, setQuery] = useState("");
  const forms = useFormsForPrimaryOrgByCategory("SOAP-Objective");
  const [active, setActive] = useState<FormsProps | null>(null);
  const [values, setValues] = React.useState<Record<string, any>>(() =>
    buildInitialValues(active?.schema ?? []),
  );

  const FormOptions = useMemo(
    () =>
      forms?.map((form) => ({
        value: form._id || form.name,
        label: form.name,
      })),
    [forms],
  );

  const handleObjectiveSelect = (id: string) => {
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
      const signatureRequired = hasSignatureField(active.schema as any);
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
      const nextSubmission = signatureRequired
        ? {
            ...created,
            signatureRequired: true,
            signing:
              created.signing ?? {
                required: true,
                status: "NOT_STARTED",
                provider: "DOCUMENSO",
              },
          }
        : created;
      setFormData((prev) => ({
        ...prev,
        objective: [nextSubmission, ...(prev.objective ?? [])],
      }));
      setActive(null);
      setQuery("");
      setValues(buildInitialValues([]));
    } catch (e) {
      console.error("Failed to save subjective submission:", e);
    }
  };

  return (
    <PermissionGate
      allOf={[PERMISSIONS.PRESCRIPTION_VIEW_ANY]}
      fallback={<Fallback />}
    >
      <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
        <Accordion
          title="Objective (clinical examination)"
          defaultOpen
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            {canEdit && (
              <SearchDropdown
                placeholder="Search"
                options={FormOptions}
                onSelect={handleObjectiveSelect}
                query={query}
                setQuery={setQuery}
                minChars={0}
              />
            )}
            {canEdit && active && (
              <FormRenderer
                fields={active.schema ?? []}
                values={values}
                onChange={handleValueChange}
                readOnly
              />
            )}
            <ObjectiveSubmissions
              formData={formData}
              setFormData={setFormData}
            />
          </div>
        </Accordion>
        {canEdit && active && (
          <Primary
            href="#"
            text="Save"
            onClick={handleSave}
          />
        )}
      </div>
    </PermissionGate>
  );
};

export default Objective;
