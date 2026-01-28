import React, { useMemo, useState } from "react";
import { Appointment, FormSubmission, InvoiceItem } from "@yosemite-crew/types";
import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import { PermissionGate } from "@/app/components/PermissionGate";
import Fallback from "@/app/components/Fallback";
import { PERMISSIONS } from "@/app/utils/permissions";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import { FormsCategory, FormsProps } from "@/app/types/forms";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import FormRenderer from "@/app/pages/Forms/Sections/AddForm/components/FormRenderer";
import { createSubmission } from "@/app/services/soapService";
import { useAuthStore } from "@/app/stores/authStore";
import { linkAppointmentForms } from "@/app/services/appointmentFormsService";
import { hasSignatureField } from "./signatureUtils";
import { FormDataProps } from "..";
import SoapSubmissions from "./Submissions/SoapSubmissions";

const SOAP_KEYS = ["assessment", "objective", "subjective", "discharge", "plan"] as const;
type SoapKey = (typeof SOAP_KEYS)[number];

type AfterCreateResult = {
  lineItems?: InvoiceItem[];
};

type PrescriptionFormSectionProps<K extends SoapKey> = {
  title: string;
  submissionsTitle: string;
  searchPlaceholder: string;
  category: FormsCategory;
  formDataKey: K;
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
  canEdit: boolean;
  onAfterCreate?: (args: {
    created: FormSubmission;
    rawCreated: FormSubmission;
    activeForm: FormsProps;
    values: Record<string, any>;
  }) => Promise<AfterCreateResult | void> | AfterCreateResult | void;
};

const PrescriptionFormSection = <K extends SoapKey>({
  title,
  submissionsTitle,
  searchPlaceholder,
  category,
  formDataKey,
  formData,
  setFormData,
  activeAppointment,
  canEdit,
  onAfterCreate,
}: PrescriptionFormSectionProps<K>) => {
  const attributes = useAuthStore.getState().attributes;
  const [query, setQuery] = useState("");
  const forms = useFormsForPrimaryOrgByCategory(category);
  const [active, setActive] = useState<FormsProps | null>(null);
  const [values, setValues] = React.useState<Record<string, any>>(() =>
    buildInitialValues(active?.schema ?? []),
  );
  const [sending, setSending] = useState(false);

  const formOptions = useMemo(
    () =>
      forms?.map((form) => ({
        value: form._id || form.name,
        label: form.name,
      })),
    [forms],
  );

  const handleSelect = (id: string) => {
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
      const afterResult = await onAfterCreate?.({
        created: nextSubmission,
        rawCreated: created,
        activeForm: active,
        values,
      });
      setFormData((prev) => {
        const next = {
          ...prev,
          [formDataKey]: [nextSubmission, ...(prev[formDataKey] ?? [])],
        } as FormDataProps;
        if (afterResult?.lineItems?.length) {
          next.lineItems = [
            ...afterResult.lineItems,
            ...(prev.lineItems ?? []),
          ];
        }
        return next;
      });
      setActive(null);
      setQuery("");
      setValues(buildInitialValues([]));
    } catch (e) {
      console.error("Failed to save submission:", e);
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

  const isClientSigner = active?.requiredSigner === "CLIENT";
  let actionText = "Save";
  if (isClientSigner) {
    actionText = sending ? "Sending..." : "Send to parent";
  }
  const handleAction = isClientSigner ? handleSendToParent : handleSave;

  return (
    <PermissionGate
      allOf={[PERMISSIONS.PRESCRIPTION_VIEW_ANY]}
      fallback={<Fallback />}
    >
      <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
        <Accordion
          title={title}
          defaultOpen={true}
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            {canEdit && (
              <SearchDropdown
                placeholder={searchPlaceholder}
                options={formOptions}
                onSelect={handleSelect}
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
            <SoapSubmissions
              formData={formData}
              setFormData={setFormData}
              formDataKey={formDataKey}
              title={submissionsTitle}
            />
          </div>
        </Accordion>
        {canEdit && active && (
          <Primary href="#" text={actionText} onClick={handleAction} />
        )}
      </div>
    </PermissionGate>
  );
};

export default PrescriptionFormSection;
