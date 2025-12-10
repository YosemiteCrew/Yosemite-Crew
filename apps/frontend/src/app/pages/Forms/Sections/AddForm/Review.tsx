import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import {
  FormField,
  FormsCategoryOptions,
  FormsProps,
  FormsUsageOptions,
} from "@/app/types/forms";
import React, { useEffect } from "react";
import FormRenderer from "./components/FormRenderer";

type ReviewProps = {
  formData: FormsProps;
  onPublish: () => void;
  onSaveDraft: () => void;
  serviceOptions: { label: string; value: string }[];
  loading?: boolean;
  isEditing?: boolean;
};

const DetailsFields = [
  { label: "Form name", key: "name", type: "text" },
  { label: "Description", key: "description", type: "text" },
  {
    label: "Category",
    key: "category",
    type: "dropdown",
    options: FormsCategoryOptions,
  },
];

const buildInitialValues = (fields: FormField[]): Record<string, any> => {
  const acc: Record<string, any> = {};
  const walk = (items: FormField[]) => {
    items.forEach((field) => {
      if (field.type === "group") {
        walk(field.fields ?? []);
        return;
      }
      if (field.type === "checkbox") {
        acc[field.id] = [];
      } else if (field.type === "boolean") {
        acc[field.id] = false;
      } else if (field.type === "date") {
        acc[field.id] = "";
      } else if (field.type === "number") {
        acc[field.id] = "";
      } else {
        acc[field.id] = field.placeholder ?? "";
      }
    });
  };
  walk(fields);
  return acc;
};

const Review = ({
  formData,
  onPublish,
  onSaveDraft,
  serviceOptions,
  loading = false,
  isEditing = false,
}: ReviewProps) => {
  const UsageFields = React.useMemo(
    () => [
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
        options: serviceOptions,
      },
      {
        label: "Species",
        key: "species",
        type: "multiSelect",
        options: ["Dog", "Cat", "Horse"],
      },
    ],
    [serviceOptions]
  );

  const [values, setValues] = React.useState<Record<string, any>>(() =>
    buildInitialValues(formData.schema ?? [])
  );

  useEffect(() => {
    setValues(buildInitialValues(formData.schema ?? []));
  }, [formData.schema]);

  const handleValueChange = (id: string, value: any) => {
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
          readOnly
        />
        <EditableAccordion
          title="Usage & visibility"
          fields={UsageFields}
          data={formData}
          defaultOpen={true}
          showEditIcon={false}
          readOnly
        />
        {(formData.schema?.length ?? 0) > 0 && (
          <Accordion
            title="Form"
            defaultOpen
            showEditIcon={false}
            isEditing={true}
          >
            <FormRenderer
              fields={formData.schema ?? []}
              values={values}
              onChange={handleValueChange}
              readOnly
            />
          </Accordion>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Primary
          href="#"
          text={isEditing ? "Update & publish" : "Publish template"}
          classname="max-h-12! text-lg! tracking-wide!"
          onClick={onPublish}
          isDisabled={loading}
        />
        <Secondary
          href="#"
          text={isEditing ? "Update draft" : "Save as draft"}
          className="max-h-12! text-lg! tracking-wide!"
          onClick={onSaveDraft}
          isDisabled={loading}
        />
      </div>
    </div>
  );
};

export default Review;
