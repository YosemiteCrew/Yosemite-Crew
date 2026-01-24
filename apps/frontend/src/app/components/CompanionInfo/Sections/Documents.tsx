import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import Fallback from "@/app/components/Fallback";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
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
    <PermissionGate
      allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]}
      fallback={<Fallback />}
    >
      <div className="flex flex-col gap-6 w-full flex-1 overflow-y-auto scrollbar-hidden">
        {Object.keys(DocumentsOptions).map((key, index) => (
          <Accordion
            key={key + index}
            title={key}
            defaultOpen={false}
            showEditIcon={false}
            isEditing={true}
          >
            <div className="flex flex-col gap-2 px-2">
              {DocumentsOptions[key].map((list, index) => (
                <Accordion
                  key={list + index}
                  title={list}
                  defaultOpen={false}
                  showEditIcon={false}
                  isEditing={true}
                ></Accordion>
              ))}
            </div>
          </Accordion>
        ))}
        <PermissionGate allOf={[PERMISSIONS.COMPANIONS_EDIT_ANY]}>
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
                  setFormData({ ...formData, category: option.value })
                }
                defaultOption={formData.category}
                options={Object.keys(DocumentsOptions).map((category) => ({
                  value: category,
                  label: category,
                }))}
                error={formDataErrors.category}
              />
              <LabelDropdown
                placeholder="Sub-category"
                onSelect={(option) =>
                  setFormData({ ...formData, sub: option.value })
                }
                defaultOption={formData.sub}
                options={(DocumentsOptions[formData.category] ?? []).map(
                  (sub) => ({
                    value: sub,
                    label: sub,
                  }),
                )}
                error={formDataErrors.sub}
              />
              <FormInput
                intype="text"
                inname="name"
                value={formData.name}
                inlabel="Breed"
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                error={formDataErrors.name}
                className="min-h-12!"
              />
              <Primary href="#" text="Save" />
            </div>
          </Accordion>
        </PermissionGate>
      </div>
    </PermissionGate>
  );
};

export default Documents;
