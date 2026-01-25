import React from "react";
import Accordion from "@/app/components/Accordion/Accordion";
import { FormDataProps } from "../../index";
import { useFormsStore } from "@/app/stores/formsStore";
import { findFieldLabel, humanizeKey } from "../labelUtils";
import SignatureActions from "./SignatureActions";
import { hasSignatureField } from "../signatureUtils";

type PlanSubmissionsProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
};

const PlanSubmissions = ({ formData, setFormData }: PlanSubmissionsProps) => {
  const formsById = useFormsStore((s) => s.formsById);
  const submissions = formData.plan ?? [];

  const toStringPairs = (answers: Record<string, any>) =>
    Object.entries(answers ?? {}).filter(
      ([k, v]) => typeof k === "string" && typeof v === "string"
    ) as Array<[string, string]>;

  const resolveLabel = (formId: string | undefined, key: string) => {
    const schema = formId ? formsById[formId]?.schema : undefined;
    return findFieldLabel(schema as any, key) ?? humanizeKey(key);
  };

  const updateSubmission = (
    submissionId: string,
    updates: Partial<FormDataProps["plan"][number]>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      plan: (prev.plan ?? []).map((s) =>
        s._id === submissionId || s.submissionId === submissionId
          ? { ...s, ...updates }
          : s,
      ),
    }));
  };

  if (submissions.length === 0) {
    return (
      <Accordion
        title="Previous plan submissions"
        defaultOpen
        showEditIcon={false}
      >
        <div className="text-sm text-black-text/60">No submissions yet.</div>
      </Accordion>
    );
  }

  return (
    <Accordion
      title="Previous plan submissions"
      defaultOpen
      showEditIcon={false}
    >
      <div className="flex flex-col gap-4">
        {submissions.map((sub) => {
          const pairs = toStringPairs(sub.answers);
          const hasContent = pairs.length > 0;
          const schema = sub.formId ? formsById[sub.formId]?.schema : undefined;
          const requiresSignature =
            hasSignatureField(schema as any) || sub.signing?.required === true;
          const signingActive =
            sub.signing?.required ||
            sub.signing?.status === "IN_PROGRESS" ||
            sub.signing?.status === "SIGNED" ||
            Boolean(sub.signing?.documentId || sub.signing?.pdf?.url);
          const showActions = requiresSignature || signingActive;
          if (!hasContent && !showActions) return null;

          return (
            <div
              key={sub._id || sub.submissionId || sub.submittedAt?.toString()}
              className="border border-black/10 rounded-xl p-4"
            >
              {hasContent ? (
                <div className="flex flex-col gap-2">
                  {pairs.map(([q, a]) => (
                    <div key={q} className="flex flex-col gap-1">
                      <div className="text-xs font-medium text-black-text/70">
                        {resolveLabel(sub.formId, q)}
                      </div>
                      <div className="text-sm text-black-text">{a}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {showActions ? (
                <SignatureActions
                  submission={{ ...sub, signatureRequired: requiresSignature }}
                  onStatusChange={updateSubmission}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </Accordion>
  );
};

export default PlanSubmissions;
