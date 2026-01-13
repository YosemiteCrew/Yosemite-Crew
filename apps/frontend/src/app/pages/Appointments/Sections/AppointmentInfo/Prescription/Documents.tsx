import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
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
      {Object.keys(DocumentsOptions).map((key, index) => (
        <Accordion
          key={key+index}
          title={key}
          defaultOpen={false}
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-2 px-2">
            {DocumentsOptions[key].map((list, index) => (
              <Accordion
                key={list+index}
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
          <LabelDropdown
            placeholder="Category"
            onSelect={(option) =>
              setFormData({ ...formData, category: option.key })
            }
            defaultOption={formData.category}
            options={Object.keys(DocumentsOptions).map((category) => ({
              key: category,
              label: category,
            }))}
            error={formDataErrors.category}
          />
          <LabelDropdown
            placeholder="Sub-category"
            onSelect={(option) => setFormData({ ...formData, sub: option.key })}
            defaultOption={formData.sub}
            options={(DocumentsOptions[formData.category] ?? []).map((sub) => ({
              key: sub,
              label: sub,
            }))}
            error={formDataErrors.sub}
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
