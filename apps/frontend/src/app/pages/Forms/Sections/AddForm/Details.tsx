import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
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
            <LabelDropdown
              placeholder="Category"
              defaultOption={formData.category || ""}
              onSelect={(option) => handleCategoryChange(option.value as FormsCategory)}
              options={FormsCategoryOptions.map((cat) => ({ label: cat, value: cat }))}
              error={formDataErrors.category}
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
            <LabelDropdown
              placeholder="Visibility type"
              defaultOption={formData.usage}
              onSelect={(option) =>
                setFormData({ ...formData, usage: option.value as FormsUsage })
              }
              options={FormsUsageOptions.map((opt) => ({ label: opt, value: opt }))}
            />
            <MultiSelectDropdown
              placeholder={formData.category === "Custom" ? "Service (Optional)" : "Service"}
              value={formData.services || []}
              error={formDataErrors.services}
              onChange={(e) => {
                setFormData({ ...formData, services: e });
                setFormDataErrors((prev) => ({ ...prev, services: undefined }));
              }}
              options={serviceOptions}
            />
            <MultiSelectDropdown
              placeholder="Species"
              value={formData.species || []}
              error={formDataErrors.species}
              onChange={(e) => {
                setFormData({ ...formData, species: e });
                setFormDataErrors((prev) => ({ ...prev, species: undefined }));
              }}
              options={["Dog", "Cat", "Horse"]}
            />
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
