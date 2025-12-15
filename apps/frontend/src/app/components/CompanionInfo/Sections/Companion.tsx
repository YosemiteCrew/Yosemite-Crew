import React from "react";
import EditableAccordion from "../../Accordion/EditableAccordion";
import { CompanionParent } from "@/app/pages/Companions/types";

const GenderOptions: string[] = ["Male", "Female", "Others"];

const Fields = [
  { label: "Date of birth", key: "dateOfBirth", type: "date" },
  { label: "Gender", key: "gender", type: "select", options: GenderOptions },
  { label: "Current weight", key: "currentWeight", type: "text" },
  { label: "Color", key: "colour", type: "text" },
  {
    label: "Neutered status",
    key: "isneutered",
    type: "select",
    options: ["yes", "no"],
  },
  { label: "Age when neutered", key: "ageWhenNeutered", type: "text" },
  { label: "Blood group", key: "bloodGroup", type: "text" },
  { label: "Country of origin", key: "countryOfOrigin", type: "country" },
  {
    label: "Pet came from",
    key: "source",
    type: "select",
    options: ["Breeder", "Foster/Shelter", "Shop", "Friends/Family", "Other"],
  },
  { label: "Microchip number", key: "microchipNumber", type: "text" },
  { label: "Passport number", key: "passportNumber", type: "text" },
  { label: "Insurance policy", key: "companyName", type: "text" },
  { label: "Insurance number", key: "policyNumber", type: "text" },
];

type CompanionType = {
  companion: CompanionParent;
};

const Companion = ({ companion }: CompanionType) => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="font-grotesk text-black-text text-[23px] font-medium">
        Companion information
      </div>

      <EditableAccordion
        title="Companion information"
        fields={Fields}
        data={{ ...companion.companion, ...companion.companion.insurance }}
        defaultOpen={true}
        showEditIcon={false}
      />
    </div>
  );
};

export default Companion;
