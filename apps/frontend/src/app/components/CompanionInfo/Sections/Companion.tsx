import React from "react";
import EditableAccordion from "../../Accordion/EditableAccordion";

const GenderOptions: string[] = ["Male", "Female", "Others"];

const Fields = [
  { label: "Date of birth", key: "dateOfBirth", type: "text" },
  { label: "Gender", key: "gender", type: "select", options: GenderOptions },
  { label: "Current weight", key: "weight", type: "text" },
  { label: "Color", key: "color", type: "text" },
  {
    label: "Neutered status",
    key: "neuteredStatus",
    type: "select",
    options: ["yes", "no"],
  },
  { label: "Age when neutered", key: "ageWhenNeutered", type: "text" },
  { label: "Blood group", key: "bloodGroup", type: "text" },
  { label: "Country of origin", key: "countryOfOrigin", type: "country" },
  {
    label: "Pet came from",
    key: "petCameFrom",
    type: "select",
    options: ["Breeder", "Foster/Shelter", "Shop", "Friends/Family", "Other"],
  },
  { label: "Microchip number", key: "microchipNumber", type: "text" },
  { label: "Passport number", key: "passportNumber", type: "text" },
  { label: "Insurance policy", key: "insurancePolicy", type: "text" },
  { label: "Insurance number", key: "insuranceNumber", type: "text" },
];

const Companion = ({ companion }: any) => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="font-grotesk text-black-text text-[23px] font-medium">
        Companion information
      </div>

      <EditableAccordion
        title="Companion information"
        fields={Fields}
        data={companion}
        defaultOpen={true}
      />
    </div>
  );
};

export default Companion;
