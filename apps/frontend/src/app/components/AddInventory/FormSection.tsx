import React from "react";
import Accordion from "../Accordion/Accordion";
import { Primary } from "../Buttons";
import FormInput from "../Inputs/FormInput/FormInput";
import Dropdown from "../Inputs/Dropdown/Dropdown";
import FormDesc from "../Inputs/FormDesc/FormDesc";
import { BusinessType } from "@/app/types/org";

import {
  InventoryItem,
  InventoryErrors,
} from "@/app/pages/Inventory/types";
import { InventoryFormConfig, ConfigItem, FieldDef } from "./InventoryConfig";

type FormSectionProps = {
  businessType: BusinessType;
  sectionKey: keyof InventoryItem;
  sectionTitle: string;
  formData: InventoryItem;
  errors: InventoryErrors;
  onFieldChange: (
    section: keyof InventoryItem,
    name: string,
    value: string
  ) => void;
  onSave?: () => void;
};

const FormSection: React.FC<FormSectionProps> = ({
  businessType,
  sectionKey,
  sectionTitle,
  formData,
  errors,
  onFieldChange,
  onSave,
}) => {
  const configForBusiness = InventoryFormConfig[businessType] || {};
  const sectionConfig = configForBusiness[sectionKey];

  if (!sectionConfig || sectionConfig.length === 0) {
    return <div className="text-sm text-gray-500">No fields configured.</div>;
  }

  const sectionData = formData[sectionKey] as any;
  const sectionErrors = errors[sectionKey] as any;

  const getValue = (field: FieldDef<any>): string =>
    sectionData?.[field.name] ?? "";
  const getError = (field: FieldDef<any>): string | undefined =>
    sectionErrors?.[field.name];

  const handleChange = (field: FieldDef<any>, value: string) => {
    onFieldChange(sectionKey, field.name, value);
  };

  const renderField = (field: FieldDef<any>, key?: React.Key) => {
    const { placeholder, component, options } = field;
    const value = getValue(field);
    const error = getError(field);

    if (component === "text" || component === "date") {
      return (
        <FormInput
          key={key ?? field.name}
          intype={component === "date" ? "date" : "text"}
          inname={field.name}
          value={value}
          inlabel={placeholder || ""}
          onChange={(e) => handleChange(field, e.target.value)}
          error={error}
          className="min-h-12!"
        />
      );
    }

    if (component === "dropdown") {
      return (
        <Dropdown
          key={key ?? field.name}
          placeholder={placeholder || ""}
          value={value}
          onChange={(v) => handleChange(field, v)}
          error={error}
          className="min-h-12!"
          dropdownClassName="top-[55px]! !h-fit"
          options={options || []}
        />
      );
    }

    if (component === "textarea") {
      return (
        <FormDesc
          key={key ?? field.name}
          intype="text"
          inname={field.name}
          value={value}
          inlabel={placeholder || ""}
          onChange={(e) => handleChange(field, e.target.value)}
          className="min-h-[120px]!"
        />
      );
    }

    return null;
  };

  const renderItem = (item: ConfigItem<any>, index: number) => {
    if ("fields" in item && item.kind === "row") {
      return (
        <div key={index} className="grid grid-cols-2 gap-3">
          {item.fields.map((field, i) => renderField(field, `${index}-${i}`))}
        </div>
      );
    }

    return (
      <div key={index} className="w-full">
        {renderField(item.field, index)}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <div className="font-grotesk text-black-text text-[23px] font-medium">
          {sectionTitle}
        </div>

        <Accordion
          title={sectionTitle}
          defaultOpen
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            {sectionConfig.map((item, index) => renderItem(item, index))}
          </div>
        </Accordion>
      </div>

      <Primary
        href="#"
        text="Save"
        classname="max-h-12! text-lg! tracking-wide!"
        onClick={onSave}
      />
    </div>
  );
};

export default FormSection;
