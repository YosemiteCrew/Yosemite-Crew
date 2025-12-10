import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import React, { useState } from "react";

const DocumentsOptions: Record<string, string[]> = {
  Health: [
    "Hospital visits",
    "Prescriptions & treatments",
    "Vaccination, parasite prevention & chronic condition",
    "Lab tests",
  ],
  "Hygiene maintenance": [
    "Grooming visits",
    "Boarding records",
    "Training & behavior reports",
    "Breeder interactions",
  ],
};

const Documents = () => {
  const [formData, setFormData] = useState({
    category: "",
    sub: "",
    name: "",
  });
  const [formDataErrors] = useState<{
    name?: string;
    category?: string;
    sub?: string;
  }>({});

  return (
    <div className="flex flex-col gap-6 w-full flex-1 overflow-y-auto">
      {Object.keys(DocumentsOptions).map((key) => (
        <Accordion
          key={key}
          title={key}
          defaultOpen={false}
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-2 px-2">
            {DocumentsOptions[key].map((list) => (
              <Accordion
                key={list}
                title={list}
                defaultOpen={false}
                showEditIcon={false}
                isEditing={true}
              ></Accordion>
            ))}
          </div>
        </Accordion>
      ))}
      <Accordion
        title="Upload records"
        defaultOpen
        showEditIcon={false}
        isEditing={true}
      >
        <div className="flex flex-col gap-3">
          <Dropdown
            placeholder="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e })}
            className="min-h-12!"
            options={Object.keys(DocumentsOptions)}
            dropdownClassName="h-fit!"
          />
          <Dropdown
            placeholder="Sub-category"
            value={formData.sub}
            onChange={(e) => setFormData({ ...formData, sub: e })}
            className="min-h-12!"
            options={DocumentsOptions[formData.category]}
            dropdownClassName="h-fit!"
          />
          <FormInput
            intype="text"
            inname="name"
            value={formData.name}
            inlabel="Breed"
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formDataErrors.name}
            className="min-h-12!"
          />
          <Primary href="#" text="Save" classname="h-13!" />
        </div>
      </Accordion>
    </div>
  );
};

export default Documents;
