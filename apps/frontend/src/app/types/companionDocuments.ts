import { Option } from "./companion";

export const CategoryOptions: Option[] = [
  {
    label: "Health",
    value: "HEALTH",
  },
  {
    label: "Hygiene maintenance",
    value: "HYGIENE_MAINTENANCE",
  },
];

export const HealthCategoryOptions: Option[] = [
  {
    label: "Hospital visits",
    value: "HOSPITAL_VISITS",
  },
  {
    label: "Prescriptions & treatments",
    value: "PRESCRIPTIONS_AND_TREATMENTS",
  },
  {
    label: "Vaccination & parasite prevention",
    value: "VACCINATION_AND_PARASITE_PREVENTION",
  },
  {
    label: "Lab tests",
    value: "LAB_TESTS",
  },
];

export const HygieneCategoryOptions: Option[] = [
  {
    label: "Grooming visits",
    value: "GROOMER_VISIT",
  },
  {
    label: "Boarding records",
    value: "BOARDER_VISIT",
  },
  {
    label: "Training & behavior reports",
    value: "TRAINING_AND_BEHAVIOUR_REPORTS",
  },
  {
    label: "Breeder interactions",
    value: "BREEDER_VISIT",
  },
];

export type Attachment = {
  key: string;
  mimeType?: string;
  size?: number;
};

export type VisitType = "HOSPITAL_VISIT";

export type Category = "HEALTH" | "HYGIENE_MAINTENANCE";

export type HealthSubcategory =
  | "HOSPITAL_VISITS"
  | "PRESCRIPTIONS_AND_TREATMENTS"
  | "VACCINATION_AND_PARASITE_PREVENTION"
  | "LAB_TESTS";

export type HygieneSubcategory =
  | "GROOMER_VISIT"
  | "BOARDER_VISIT"
  | "TRAINING_AND_BEHAVIOUR_REPORTS"
  | "BREEDER_VISIT";

export type Subcategory = HealthSubcategory | HygieneSubcategory;

export type CompanionRecord = {
  id?: string;
  title: string;
  category: Category;
  subcategory: Subcategory;
  attachments: Attachment[];
  appointmentId?: string;
  companionId?: string;
  visitType?: VisitType;
  issuingBusinessName?: string;
  issueDate?: string;
};

export const emptyCompanionRecord: CompanionRecord = {
  title: "",
  category: "HEALTH",
  subcategory: "HOSPITAL_VISITS",
  attachments: [],
  appointmentId: undefined,
  visitType: "HOSPITAL_VISIT",
  issuingBusinessName: undefined,
  issueDate: undefined,
};

export type SignedFile = {
  url: string;
  mimeType: string;
  key: string;
};

