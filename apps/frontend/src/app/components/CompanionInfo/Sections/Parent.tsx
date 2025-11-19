import React from "react";
import EditableAccordion from "../../Accordion/EditableAccordion";

const Fields = [
  { label: "Parent", key: "parent", type: "text" },
  { label: "Email", key: "parentEmail", type: "email" },
  { label: "Phone number", key: "parentNumber", type: "tel" },
  { label: "Co-parent", key: "coParentName", type: "text" },
  { label: "Email", key: "coParentEmail", type: "email" },
  { label: "Phone number", key: "coParentNumber", type: "tel" },
];

const Parent = ({ companion }: any) => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="font-grotesk text-black-text text-[23px] font-medium">
        Parent information
      </div>

      <EditableAccordion
        title="Parent information"
        fields={Fields}
        data={companion}
        defaultOpen={true}
      />
    </div>
  );
};

export default Parent;
