import React from "react";
import EditableAccordion from "../../Accordion/EditableAccordion";
import { CompanionParent, StoredCompanion } from "@/app/pages/Companions/types";
import { GenderOptionsSmall, PetSourceOptions } from "@/app/types/companion";
import { updateCompanion } from "@/app/services/companionService";
import { NeuteredOptions } from "../../AddCompanion/type";

const Fields = [
  { label: "Date of birth", key: "dateOfBirth", type: "date", required: true },
  {
    label: "Gender",
    key: "gender",
    type: "select",
    options: GenderOptionsSmall,
  },
  { label: "Current weight (lbs)", key: "currentWeight", type: "number" },
  { label: "Color", key: "colour", type: "text" },
  {
    label: "Neutered status",
    key: "isneutered",
    type: "select",
    options: NeuteredOptions,
  },
  { label: "Age when neutered", key: "ageWhenNeutered", type: "number" },
  { label: "Blood group", key: "bloodGroup", type: "text" },
  { label: "Country of origin", key: "countryOfOrigin", type: "country" },
  {
    label: "Pet came from",
    key: "source",
    type: "select",
    options: PetSourceOptions,
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
  const handleSave = async (values: any) => {
    try {
      const newCompanion: StoredCompanion = {
        ...companion.companion,
        dateOfBirth: new Date(values.dateOfBirth),
        gender: values.gender,
        currentWeight: Number(values.currentWeight),
        colour: values.colour,
        isneutered: values.isneutered === "true",
        ageWhenNeutered: values.ageWhenNeutered,
        bloodGroup: values.bloodGroup,
        countryOfOrigin: values.country,
        source: values.source,
        microchipNumber: values.microchipNumber,
        passportNumber: values.passportNumber,
        isInsured: Boolean(values.policyNumber) || Boolean(values.companyName),
        insurance: {
          isInsured:
            Boolean(values.policyNumber) || Boolean(values.companyName),
          policyNumber: values.policyNumber,
          companyName: values.companyName,
        },
      };
      await updateCompanion(newCompanion);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <EditableAccordion
        title="Companion information"
        fields={Fields}
        data={{
          ...companion.companion,
          ...companion.companion.insurance,
          isneutered: companion.companion.isneutered ? "true" : "false",
        }}
        defaultOpen={true}
        onSave={handleSave}
      />
    </div>
  );
};

export default Companion;
