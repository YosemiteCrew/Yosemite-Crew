import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import { flatServices } from "@/app/pages/Organization/demo";
import {
  FormsCategory,
  FormsCategoryOptions,
  FormsProps,
  FormsUsage,
  FormsUsageOptions,
} from "@/app/types/forms";
import React, { useState } from "react";

type DetailsProps = {
  formData: FormsProps;
  setFormData: React.Dispatch<React.SetStateAction<FormsProps>>;
};

const Details = ({ formData, setFormData }: DetailsProps) => {
  const [formDataErrors] = useState<{
    name?: string;
  }>({});

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <Accordion
          title="Form details"
          defaultOpen
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            <FormInput
              intype="text"
              inname="name"
              value={formData.name}
              inlabel="Form name"
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              error={formDataErrors.name}
              className="min-h-12!"
            />
            <FormInput
              intype="text"
              inname="description"
              value={formData.description || ""}
              inlabel="Description"
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              error={formDataErrors.name}
              className="min-h-12!"
            />
            <Dropdown
              placeholder="Category"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e as FormsCategory })
              }
              className="min-h-12!"
              dropdownClassName="top-[55px]! !h-fit"
              options={FormsCategoryOptions}
            />
          </div>
        </Accordion>
        <Accordion
          title="Usage and visibility"
          defaultOpen
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            <Dropdown
              placeholder="Visibility type"
              value={formData.usage}
              onChange={(e) =>
                setFormData({ ...formData, usage: e as FormsUsage })
              }
              className="min-h-12!"
              dropdownClassName="top-[55px]! !h-fit"
              options={FormsUsageOptions}
            />
            <MultiSelectDropdown
              placeholder="Service (Optional)"
              value={formData.services || []}
              onChange={(e) => setFormData({ ...formData, services: e })}
              className="min-h-12!"
              options={flatServices}
              dropdownClassName="h-fit!"
            />
            <MultiSelectDropdown
              placeholder="Species"
              value={formData.species || []}
              onChange={(e) => setFormData({ ...formData, species: e })}
              className="min-h-12!"
              options={["Dog", "Cat", "Horse"]}
              dropdownClassName="h-fit!"
            />
          </div>
        </Accordion>
      </div>
      <Primary
        href="#"
        text="Save"
        classname="max-h-12! text-lg! tracking-wide!"
      />
    </div>
  );
};

export default Details;
