import React from "react";
import Accordion from "@/app/components/Accordion/Accordion";
import { FormDataProps } from "../../index";
import { useFormsStore } from "@/app/stores/formsStore";
import { findFieldLabel, humanizeKey } from "../labelUtils";
import SignatureActions from "./SignatureActions";
import { hasSignatureField } from "../signatureUtils";

type AssessmentSubmissionsProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
};

const AssessmentSubmissions = ({
  formData,
  setFormData,
}: AssessmentSubmissionsProps) => {
  const formsById = useFormsStore((s) => s.formsById);
  const submissions = formData.assessment ?? [];

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
    updates: Partial<FormDataProps["assessment"][number]>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      assessment: (prev.assessment ?? []).map((s) =>
        s._id === submissionId || s.submissionId === submissionId
          ? { ...s, ...updates }
          : s,
      ),
    }));
  };

  if (submissions.length === 0) {
    return (
      <Accordion
        title="Previous assessment submissions"
        defaultOpen
        showEditIcon={false}
      >
        <div className="text-sm text-black-text/60">No submissions yet.</div>
      </Accordion>
    );
  }

  return (
    <Accordion
      title="Previous assessment submissions"
      defaultOpen
      showEditIcon={false}
    >
      <div className="flex flex-col gap-4">
        {submissions.map((sub) => {
          const pairs = toStringPairs(sub.answers);
          const hasContent = pairs.length > 0;
          const form = sub.formId ? formsById[sub.formId] : undefined;
          const schema = form?.schema;
          const requiredSigner = form?.requiredSigner;
          const isClientSigner = requiredSigner === "CLIENT";
          const allowVetSigning = requiredSigner === "VET";
          const hasSignature = hasSignatureField(schema as any);
          const hasSigningData = Boolean(
            sub.signing?.status || sub.signing?.documentId || sub.signing?.pdf?.url
          );
          const requiresVetSignature = allowVetSigning && (hasSignature || hasSigningData);
          const showActions = requiresVetSignature;
          const parentSigned =
            isClientSigner &&
            (sub.signing?.status === "SIGNED" || Boolean(sub.signing?.pdf?.url));
          const showParentStatus = isClientSigner;
          if (!hasContent && !showActions && !showParentStatus) return null;

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
                  submission={{ ...sub, signatureRequired: requiresVetSignature }}
                  onStatusChange={updateSubmission}
                />
              ) : null}
              {showParentStatus ? (
                <div className="text-xs text-text-secondary">
                  {parentSigned
                    ? "Signed by pet parent."
                    : "Sent to pet parent. It will update when they sign the document."}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Accordion>
  );
};

export default AssessmentSubmissions;
