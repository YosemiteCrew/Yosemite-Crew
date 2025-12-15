import React from "react";
import Accordion from "@/app/components/Accordion/Accordion";
import { FormDataProps } from "../../index";

type SubjectiveSubmissionsProps = {
  formData: FormDataProps;
};

const SubjectiveSubmissions = ({ formData }: SubjectiveSubmissionsProps) => {
  const submissions = formData.subjective ?? [];

  const toStringPairs = (answers: Record<string, any>) =>
    Object.entries(answers ?? {}).filter(
      ([k, v]) => typeof k === "string" && typeof v === "string"
    ) as Array<[string, string]>;

  if (submissions.length === 0) {
    return (
      <Accordion
        title="Previous subjective submissions"
        defaultOpen
        showEditIcon={false}
      >
        <div className="text-sm text-black-text/60">No submissions yet.</div>
      </Accordion>
    );
  }

  return (
    <Accordion
      title="Previous subjective submissions"
      defaultOpen
      showEditIcon={false}
    >
      <div className="flex flex-col gap-4">
        {submissions.map((sub) => {
          const pairs = toStringPairs(sub.answers);
          if (pairs.length === 0) return null;

          return (
            <div
              key={sub._id || sub.submittedAt?.toString()}
              className="border border-black/10 rounded-xl p-4"
            >
              <div className="flex flex-col gap-2">
                {pairs.map(([q, a]) => (
                  <div key={q} className="flex flex-col gap-1">
                    <div className="text-xs font-medium text-black-text/70">
                      {q}
                    </div>
                    <div className="text-sm text-black-text">{a}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Accordion>
  );
};

export default SubjectiveSubmissions;
