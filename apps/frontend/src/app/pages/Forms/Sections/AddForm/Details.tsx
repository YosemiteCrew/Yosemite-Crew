import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import {
  FormsCategory,
  FormsCategoryOptions,
  FormsProps,
  FormsUsage,
  FormsUsageOptions,
} from "@/app/types/forms";
import { getCategoryTemplate } from "@/app/utils/forms";
import React, { useState } from "react";

type DetailsProps = {
  formData: FormsProps;
  setFormData: React.Dispatch<React.SetStateAction<FormsProps>>;
  onNext: () => void;
  serviceOptions: { label: string; value: string }[];
  registerValidator?: (fn: () => boolean) => void;
};

const Details = ({
  formData,
  setFormData,
  onNext,
  serviceOptions,
  registerValidator,
}: DetailsProps) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    category?: string;
    species?: string;
    description?: string;
    services?: string;
  }>({});

  const handleCategoryChange = (category: FormsCategory) => {
    const shouldApplyTemplate =
      !formData._id || (formData.schema?.length ?? 0) === 0;
    if (formDataErrors.category) {
      setFormDataErrors((prev) => ({ ...prev, category: undefined }));
    }
    setFormData((prev) => ({
      ...prev,
      category,
      schema:
        category && shouldApplyTemplate ? getCategoryTemplate(category) : prev.schema,
    }));
  };

  const validate = React.useCallback(() => {
    const errors: {
      name?: string;
      category?: string;
      species?: string;
      description?: string;
      services?: string;
    } = {};
    if (!formData.name.trim()) {
      errors.name = "Form name is required";
    }
    if (!formData.category) {
      errors.category = "Category is required";
    }
    if (!formData.description?.trim()) {
      errors.description = "Description is required";
    }
    if (!formData.species || formData.species.length === 0) {
      errors.species = "Select at least one species";
    }
    // Service is required for all categories except "Custom"
    if (formData.category !== "Custom" && (!formData.services || formData.services.length === 0)) {
      errors.services = "Service is required for this form category";
    }
    setFormDataErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleNext = () => {
    if (!validate()) return;
    onNext();
  };

  React.useEffect(() => {
    registerValidator?.(validate);
  }, [registerValidator, validate]);

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
              onChange={(e) => {
                if (formDataErrors.name) {
                  setFormDataErrors((prev) => ({ ...prev, name: undefined }));
                }
                setFormData({
                  ...formData,
                  name: e.target.value,
                });
              }}
              error={formDataErrors.name}
              className="min-h-12!"
            />
            <FormInput
              intype="text"
              inname="description"
              value={formData.description || ""}
              inlabel="Description"
              onChange={(e) => {
                if (formDataErrors.description) {
                  setFormDataErrors((errs) => ({
                    ...errs,
                    description: undefined,
                  }));
                }
                setFormData((prev) => ({ ...prev, description: e.target.value }));
              }}
              error={formDataErrors.description}
              className="min-h-12!"
            />
            <Dropdown
              placeholder="Category"
              value={formData.category || ""}
              onChange={(e) => handleCategoryChange(e as FormsCategory)}
              className="min-h-12!"
              dropdownClassName="top-[55px]! !h-fit"
              options={FormsCategoryOptions}
            />
            {formDataErrors.category && (
              <span className="text-red-500 text-sm">{formDataErrors.category}</span>
            )}
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
              placeholder={formData.category === "Custom" ? "Service (Optional)" : "Service"}
              value={formData.services || []}
              onChange={(e) => {
                setFormData({ ...formData, services: e });
                setFormDataErrors((prev) => ({ ...prev, services: undefined }));
              }}
              options={serviceOptions}
            />
            {formDataErrors.services && (
              <span className="text-red-500 text-sm">{formDataErrors.services}</span>
            )}
            <MultiSelectDropdown
              placeholder="Species"
              value={formData.species || []}
              onChange={(e) => {
                setFormData({ ...formData, species: e });
                setFormDataErrors((prev) => ({ ...prev, species: undefined }));
              }}
              options={["Dog", "Cat", "Horse"]}
            />
            {formDataErrors.species && (
              <span className="text-red-500 text-sm">{formDataErrors.species}</span>
            )}
          </div>
        </Accordion>
      </div>
      <Primary
        href="#"
        text="Next"
        onClick={handleNext}
        classname="max-h-12! text-lg! tracking-wide!"
      />
    </div>
  );
};

export default Details;
