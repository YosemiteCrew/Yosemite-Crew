import { Service } from "@/app/types/org";
import { Breed, Specie } from "./companion";

export type FormsCategory =
  | "Consent form"
  | "Medical note"
  | "Vaccination"
  | "Discharge"
  | "Procedure";

export type FormsUsage = "Internal" | "External" | "Internal & External";

export type FormsStatus = "Published" | "Draft" | "Archived";

export type FormsProps = {
  name: string;
  description?: string;
  services?: Service[];
  species?: Specie[];
  breed?: Breed[];
  category: FormsCategory;
  usage: FormsUsage;
  updatedBy: string;
  lastUpdated: string;
  status?: FormsStatus;
};


