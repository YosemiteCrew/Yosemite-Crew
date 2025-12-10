import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import { flatServices } from "@/app/pages/Organization/demo";
import {
  FormField,
  FormsCategoryOptions,
  FormsProps,
  FormsUsageOptions,
} from "@/app/types/forms";
import React from "react";
import FormRenderer from "./components/FormRenderer";

type ReviewProps = {
  formData: FormsProps;
};

const DetailsFields = [
  { label: "Form name", key: "name", type: "text" },
  { label: "Description", key: "descrition", type: "text" },
  {
    label: "Category",
    key: "category",
    type: "dropdown",
    options: FormsCategoryOptions,
  },
];

const UsageFields = [
  {
    label: "Visibility type",
    key: "usage",
    type: "dropdown",
    options: FormsUsageOptions,
  },
  {
    label: "Service",
    key: "services",
    type: "multiSelect",
    options: flatServices,
  },
  {
    label: "Species",
    key: "species",
    type: "multiSelect",
    options: ["Dog", "Cat", "Horse"],
  },
];

const buildInitialValues = (fields: FormField[]): Record<string, string> =>
  fields.reduce(
    (acc, field) => {
      if (field.type === "input") {
        acc[field.id] = field.value ?? "";
      } else {
        acc[field.id] = "";
      }
      return acc;
    },
    {} as Record<string, string>
  );

const Review = ({ formData }: ReviewProps) => {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    buildInitialValues(formData.fields ?? [])
  );

  const handleValueChange = (id: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <EditableAccordion
          title="Form details"
          fields={DetailsFields}
          data={formData}
          defaultOpen={true}
          showEditIcon={false}
        />
        <EditableAccordion
          title="Usage & visibility"
          fields={UsageFields}
          data={formData}
          defaultOpen={true}
          showEditIcon={false}
        />
        {(formData.fields?.length ?? 0) > 0 && (
          <Accordion
            title="Form"
            defaultOpen
            showEditIcon={false}
            isEditing={true}
          >
            <FormRenderer
              fields={formData.fields ?? []}
              values={values}
              onChange={handleValueChange}
            />
          </Accordion>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Primary
          href="#"
          text="Publish template"
          classname="max-h-12! text-lg! tracking-wide!"
        />
        <Secondary
          href="#"
          text="Save as draft"
          className="max-h-12! text-lg! tracking-wide!"
        />
      </div>
    </div>
  );
};

export default Review;
