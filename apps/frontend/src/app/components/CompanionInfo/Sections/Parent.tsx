import React from "react";
import EditableAccordion from "../../Accordion/EditableAccordion";
import { CompanionParent } from "@/app/pages/Companions/types";

const Fields = [
  { label: "First name", key: "firstName", type: "text" },
  { label: "Last name", key: "lastName", type: "text" },
  { label: "Email", key: "email", type: "email" },
  { label: "Phone number", key: "phoneNumber", type: "tel" },
];

type ParentType = {
  companion: CompanionParent;
};

const Parent = ({ companion }: ParentType) => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="font-grotesk text-black-text text-[23px] font-medium">
        Parent information
      </div>

      <EditableAccordion
        title="Parent information"
        fields={Fields}
        data={companion.parent}
        defaultOpen={true}
        showEditIcon={false}
      />
    </div>
  );
};

export default Parent;
