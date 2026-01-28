import React from "react";
import { Appointment, FormSubmission, InvoiceItem } from "@yosemite-crew/types";
import { FormDataProps } from "..";
import PrescriptionFormSection from "./PrescriptionFormSection";
import {
  addLineItemsToAppointments,
  loadInvoicesForOrgPrimaryOrg,
} from "@/app/services/invoiceService";

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
  const handleAfterCreate = async ({
    rawCreated,
  }: {
    rawCreated: FormSubmission;
  }) => {
    if (!activeAppointment.id) return undefined;
    const medicationItems = buildMedicationLineItemsFromPlan([rawCreated]);
    if (medicationItems.length > 0) {
      await addLineItemsToAppointments(medicationItems, activeAppointment.id);
      await loadInvoicesForOrgPrimaryOrg({ force: true });
      return { lineItems: medicationItems };
    }
    return undefined;
  };

  return (
    <PrescriptionFormSection
      title="Treatment/Plan"
      submissionsTitle="Previous plan submissions"
      searchPlaceholder="Search plan"
      category="SOAP-Plan"
      formDataKey="plan"
      formData={formData}
      setFormData={setFormData}
      activeAppointment={activeAppointment}
      canEdit={canEdit}
      onAfterCreate={handleAfterCreate}
    />
  );
};

export default Plan;
