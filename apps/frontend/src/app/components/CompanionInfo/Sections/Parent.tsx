import React from "react";
import EditableAccordion from "../../Accordion/EditableAccordion";
import { CompanionParent, StoredParent } from "@/app/pages/Companions/types";
import { updateParent } from "@/app/services/companionService";

const Fields = [
  { label: "First name", key: "firstName", type: "text", required: true },
  { label: "Last name", key: "lastName", type: "text", required: true },
  { label: "Email", key: "email", type: "email", editable: false },
  { label: "Phone number", key: "phoneNumber", type: "tel", editable: false },
];

type ParentType = {
  companion: CompanionParent;
};

const Parent = ({ companion }: ParentType) => {
  const handleSave = async (values: any) => {
    try {
      const newParent: StoredParent = {
        ...companion.parent,
        firstName: values.firstName,
        lastName: values.lastName,
      };
      await updateParent(newParent);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <EditableAccordion
        title="Parent information"
        fields={Fields}
        data={companion.parent}
        defaultOpen={true}
        showEditIcon={false}
        onSave={handleSave}
      />
    </div>
  );
};

export default Parent;
