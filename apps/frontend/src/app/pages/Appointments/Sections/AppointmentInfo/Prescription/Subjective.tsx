import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import React, { useMemo, useState } from "react";
import { Appointment, FormSubmission } from "@yosemite-crew/types";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import { FormsProps } from "@/app/types/forms";
import FormRenderer from "@/app/pages/Forms/Sections/AddForm/components/FormRenderer";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import { FormDataProps } from "..";
import { createSubmission } from "@/app/services/soapService";
import { useAuthStore } from "@/app/stores/authStore";
import SubjectiveSubmissions from "./Submissions/SubjectiveSubmissions";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import Fallback from "@/app/components/Fallback";
import { hasSignatureField } from "./signatureUtils";
import { linkAppointmentForms } from "@/app/services/appointmentFormsService";

type SubjectiveProps = {
  activeAppointment: Appointment;
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  canEdit: boolean;
};

const Subjective = ({
  activeAppointment,
  formData,
  setFormData,
  canEdit
}: SubjectiveProps) => {
  const attributes = useAuthStore.getState().attributes;
  const [query, setQuery] = useState("");
  const forms = useFormsForPrimaryOrgByCategory("SOAP-Subjective");
  const [active, setActive] = useState<FormsProps | null>(null);
  const [values, setValues] = React.useState<Record<string, any>>(() =>
    buildInitialValues(active?.schema ?? []),
  );
  const [sending, setSending] = useState(false);

  const FormOptions = useMemo(
    () =>
      forms?.map((form) => ({
        value: form._id || form.name,
        label: form.name,
      })),
    [forms],
  );

  const handleSubjectiveSelect = (id: string) => {
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
      if (active.requiredSigner === "CLIENT") return;
      const signatureRequired =
        active.requiredSigner === "VET" && hasSignatureField(active.schema as any);
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
        subjective: [nextSubmission, ...(prev.subjective ?? [])],
      }));
      setActive(null);
      setQuery("");
      setValues(buildInitialValues([]));
    } catch (e) {
      console.error("Failed to save subjective submission:", e);
    }
  };

  const handleSendToParent = async () => {
    if (!active?._id || !activeAppointment.id) return;
    if (active.requiredSigner !== "CLIENT") return;
    const orgId = activeAppointment.organisationId;
    if (!orgId) return;
    setSending(true);
    try {
      await linkAppointmentForms({
        organisationId: orgId,
        appointmentId: activeAppointment.id,
        formIds: [active._id],
      });
      setActive(null);
      setQuery("");
      setValues(buildInitialValues([]));
    } catch (e) {
      console.error("Failed to send form to parent:", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <PermissionGate
      allOf={[PERMISSIONS.PRESCRIPTION_VIEW_ANY]}
      fallback={<Fallback />}
    >
      <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
        <Accordion
          title="Subjective (history)"
          defaultOpen
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-4">
            {canEdit && (
              <SearchDropdown
                placeholder="Search"
                options={FormOptions}
                onSelect={handleSubjectiveSelect}
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
            <SubjectiveSubmissions
              formData={formData}
              setFormData={setFormData}
            />
          </div>
        </Accordion>
        {canEdit && active && (
          <Primary
            href="#"
            text={
              active.requiredSigner === "CLIENT"
                ? sending
                  ? "Sending..."
                  : "Send to parent"
                : "Save"
            }
            onClick={active.requiredSigner === "CLIENT" ? handleSendToParent : handleSave}
          />
        )}
      </div>
    </PermissionGate>
  );
};

export default Subjective;
