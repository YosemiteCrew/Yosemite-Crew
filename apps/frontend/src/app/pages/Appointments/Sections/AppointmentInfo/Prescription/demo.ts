export const DemoSubjective = [
  {
    name: "Chief Complaint",
    id: "subj-001",
    description:
      "Patient reports persistent lower back pain for the past three days, worsened by bending or prolonged sitting.",
  },
  {
    name: "History of Present Illness",
    id: "subj-002",
    description:
      "Patient describes the onset of headache one week ago, gradually increasing in intensity. No history of trauma.",
  },
  {
    name: "Associated Symptoms",
    id: "subj-003",
    description:
      "Patient notes mild nausea and occasional dizziness accompanying the headache but denies vomiting.",
  },
  {
    name: "Patient Concerns",
    id: "subj-004",
    description:
      "Patient expresses concern about whether the pain could indicate a more serious issue, such as a pinched nerve.",
  },
  {
    name: "Relevant Medical History",
    id: "subj-005",
    description:
      "Patient has a history of chronic migraines and hypertension. Reports inconsistent adherence to prescribed medication.",
  },
];

export function mapSubjectiveFields(data: any) {
  return data.map((item: any) => ({
    value: item.name,
    key: item.id
  }));
}

export const DemoSubjectiveOptions = mapSubjectiveFields(DemoSubjective) 

