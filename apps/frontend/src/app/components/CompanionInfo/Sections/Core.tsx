import React from "react";
import EditableAccordion from "../../Accordion/EditableAccordion";

const BreedingFields = [{ label: "Breed dog", key: "breedDog", type: "text" }];

const Core = ({ companion }: any) => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="font-grotesk text-black-text text-[23px] font-medium">
        Core information
      </div>

      <EditableAccordion
        title="Breeding information"
        fields={BreedingFields}
        data={companion}
      />
      <EditableAccordion
        title="Physical information"
        fields={BreedingFields}
        data={companion}
      />
    </div>
  );
};

export default Core;
