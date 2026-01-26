import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import Accordion from "@/app/components/Accordion/Accordion";
import React, { useMemo, useState } from "react";
import { Primary } from "@/app/components/Buttons";
import { FormDataProps } from "..";
import { Appointment, FormSubmission, InvoiceItem } from "@yosemite-crew/types";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import { FormsProps } from "@/app/types/forms";
import FormRenderer from "@/app/pages/Forms/Sections/AddForm/components/FormRenderer";
import { useAuthStore } from "@/app/stores/authStore";
import { createSubmission } from "@/app/services/soapService";
import PlanSubmissions from "./Submissions/PlanSubmissions";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import Fallback from "@/app/components/Fallback";
import {
  addLineItemsToAppointments,
  loadInvoicesForOrgPrimaryOrg,
} from "@/app/services/invoiceService";
import { hasSignatureField } from "./signatureUtils";
import { linkAppointmentForms } from "@/app/services/appointmentFormsService";

type PlanProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
  canEdit: boolean;
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v == null) return 0;
  return 0;
};

const mergeAnswers = (subs: FormSubmission[]): Record<string, any> =>
  subs.reduce<Record<string, any>>(
    (acc, s) => Object.assign(acc, s.answers ?? {}),
    {},
  );

const buildMedicationLineItemsFromPlan = (
  planSubs: FormSubmission[],
): InvoiceItem[] => {
  const answers = mergeAnswers(planSubs);
  const indices = new Set<number>();
  const medNameRegex = /^medications_med_(\d+)_name$/;
  for (const key of Object.keys(answers)) {
    const m = medNameRegex.exec(key);
    if (m) indices.add(Number(m[1]));
  }
  const items: InvoiceItem[] = [];
  [...indices]
    .sort((a, b) => a - b)
    .forEach((i) => {
      const name = String(answers[`medications_med_${i}_name`] ?? "").trim();
      if (!name) return;
      const unitPrice = toNumber(answers[`medications_med_${i}_price`]);
      const quantity = 1;
      const total = unitPrice * quantity;
      items.push({
        name,
        quantity,
        unitPrice,
        total,
      });
    });

  return items;
};

const Plan = ({
  formData,
  setFormData,
  activeAppointment,
  canEdit,
}: PlanProps) => {
  const attributes = useAuthStore.getState().attributes;
  const [planQuery, setPlanQuery] = useState("");
  const forms = useFormsForPrimaryOrgByCategory("SOAP-Plan");
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
      const medicationItems = buildMedicationLineItemsFromPlan([created]);
      if (medicationItems.length > 0) {
        await addLineItemsToAppointments(medicationItems, activeAppointment.id);
        await loadInvoicesForOrgPrimaryOrg({ force: true });
      }
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
        plan: [nextSubmission, ...(prev.plan ?? [])],
        lineItems:
          medicationItems.length > 0
            ? [...medicationItems, ...(prev.lineItems ?? [])]
            : prev.lineItems ?? [],
      }));
      setActive(null);
      setPlanQuery("");
      setValues(buildInitialValues([]));
    } catch (e) {
      console.error("Failed to save plan submission:", e);
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
      setPlanQuery("");
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
          title="Treatment/Plan"
          defaultOpen={true}
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            {canEdit && (
              <SearchDropdown
                placeholder="Search plan"
                options={FormOptions}
                onSelect={handlePlanSelect}
                query={planQuery}
                setQuery={setPlanQuery}
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
            <PlanSubmissions formData={formData} setFormData={setFormData} />
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

export default Plan;
