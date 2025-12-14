import React from "react";
import Accordion from "../Accordion/Accordion";
import { Primary, Secondary } from "../Buttons";
import FormInput from "../Inputs/FormInput/FormInput";
import Dropdown from "../Inputs/Dropdown/Dropdown";
import MultiSelectDropdown from "../Inputs/MultiSelectDropdown";
import FormDesc from "../Inputs/FormDesc/FormDesc";
import Datepicker from "../Inputs/Datepicker";
import { Icon } from "@iconify/react/dist/iconify.js";
import { BusinessType } from "@/app/types/org";

import { InventoryItem, InventoryErrors } from "@/app/pages/Inventory/types";
import {
  InventoryFormConfig,
  ConfigItem,
  FieldDef,
  InventorySectionKey,
} from "./InventoryConfig";

type FormSectionProps = {
  businessType: BusinessType;
  sectionKey: InventorySectionKey;
  sectionTitle: string;
  formData: InventoryItem;
  errors: InventoryErrors;
  onFieldChange: (
    section: InventorySectionKey,
    name: string,
    value: string | string[],
    index?: number
  ) => void;
  onSave?: () => void;
  saveLabel?: string;
  disableSave?: boolean;
  onClear?: () => void;
  onAddBatch?: () => void;
  onRemoveBatch?: (index: number) => void;
};

const FormSection: React.FC<FormSectionProps> = ({
  businessType,
  sectionKey,
  sectionTitle,
  formData,
  errors,
  onFieldChange,
  onSave,
  saveLabel,
  disableSave,
  onClear,
  onAddBatch,
  onRemoveBatch,
}) => {
  const configForBusiness = InventoryFormConfig[businessType] || {};
  const sectionConfig = configForBusiness[sectionKey];

  if (!sectionConfig || sectionConfig.length === 0) {
    return <div className="text-sm text-gray-500">No fields configured.</div>;
  }

  const sectionData = formData[sectionKey] as any;
  const sectionErrors = (errors as Record<InventorySectionKey, any>)[sectionKey];

  const parseDate = (value?: string): Date | null => {
    if (!value) return null;
    if (value.includes("/")) {
      const [dd, mm, yyyy] = value.split("/");
      const parsed = new Date(`${yyyy}-${mm}-${dd}`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  const getValue = (field: FieldDef<any>): string =>
    sectionData?.[field.name] ?? "";
  const getError = (field: FieldDef<any>): string | undefined =>
    sectionErrors?.[field.name];

  const handleChange = (
    field: FieldDef<any>,
    value: string | string[],
    batchIndex?: number
  ) => {
    onFieldChange(sectionKey, field.name, value, batchIndex);
  };

  const renderField = (
    field: FieldDef<any>,
    key?: React.Key,
    index?: number
  ) => {
    const { placeholder, component, options } = field;
    const value =
      sectionKey === "batch" && typeof index === "number"
        ? (formData.batches?.[index] as any)?.[field.name] ?? ""
        : getValue(field);
    const error =
      sectionKey === "batch" && typeof index === "number"
        ? (errors.batch as any)?.[field.name]
        : getError(field);

    if (component === "text") {
      return (
        <FormInput
          key={key ?? field.name}
          intype="text"
          inname={field.name}
          value={value}
          inlabel={placeholder || ""}
          onChange={(e) => handleChange(field, e.target.value, index)}
          error={error}
          className="min-h-12!"
        />
      );
    }

    if (component === "date") {
      const currentDate = parseDate(value);
      return (
        <div key={key ?? field.name} className="flex flex-col gap-1">
          <Datepicker
            currentDate={currentDate}
            setCurrentDate={(next: Date | null | ((prev: Date | null) => Date | null)) => {
              const resolved =
                typeof next === "function"
                  ? (next as (prev: Date | null) => Date | null)(currentDate)
                  : next;
              if (!resolved) {
                handleChange(field, "", index);
                return;
              }
              handleChange(field, formatDate(resolved), index);
            }}
            placeholder={placeholder || ""}
            type="input"
            className="min-h-12!"
          />
          {error && (
            <div className="Errors">
              <Icon icon="mdi:error" width="16" height="16" />
              {error}
            </div>
          )}
        </div>
      );
    }

    if (component === "dropdown") {
      return (
        <Dropdown
          key={key ?? field.name}
          placeholder={placeholder || ""}
          value={value}
          onChange={(v) => handleChange(field, v, index)}
          error={error}
          className="min-h-12!"
          dropdownClassName="top-[55px]! !h-fit"
          options={options || []}
        />
      );
    }

    if (component === "multiSelect") {
      let arrayValue: string[];
      if (Array.isArray(value)) {
        arrayValue = value;
      } else if (value) {
        arrayValue = String(value).split(",").map((v) => v.trim());
      } else {
        arrayValue = [];
      }
      return (
        <MultiSelectDropdown
          key={key ?? field.name}
          placeholder={placeholder || ""}
          value={arrayValue}
          onChange={(vals) => handleChange(field, vals, index)}
          className="min-h-12!"
          options={options || []}
          dropdownClassName="h-fit!"
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
          onChange={(e) => handleChange(field, e.target.value, index)}
          className="min-h-[120px]!"
        />
      );
    }

    return null;
  };

  const renderItem = (item: ConfigItem<any>, index: number, batchIndex?: number) => {
    if ("fields" in item && item.kind === "row") {
      return (
        <div key={index} className="grid grid-cols-2 gap-3">
          {item.fields.map((field, i) =>
            renderField(field, `${index}-${i}`, batchIndex)
          )}
        </div>
      );
    }

    return (
      <div key={index} className="w-full">
        {renderField(item.field, index, batchIndex)}
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
          {sectionKey === "batch" ? (
            <div className="flex flex-col gap-6">
              {(formData.batches && formData.batches.length > 0
                ? formData.batches
                : [formData.batch]
              ).map((batch, batchIdx) => (
                <div key={batch._id ?? `batch-${batchIdx}`} className="flex flex-col gap-3 border border-grey-light rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-satoshi font-semibold text-black-text">
                      Batch {batchIdx + 1}
                    </div>
                    {formData.batches && formData.batches.length > 1 && (
                      <button
                        type="button"
                        className="text-red-500 text-sm font-semibold"
                        onClick={() => onRemoveBatch?.(batchIdx)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    {sectionConfig.map((item, index) =>
                      renderItem(item, index, batchIdx)
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onAddBatch?.()}
                className="w-full h-12 rounded-xl border border-dashed border-grey-light text-black-text font-satoshi font-semibold hover:bg-grey-bg"
              >
                Add another batch
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sectionConfig.map((item, index) => renderItem(item, index))}
            </div>
          )}
        </Accordion>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Secondary
          href="#"
          text="Clear"
          onClick={onClear}
          isDisabled={disableSave}
          className="h-12! text-lg! tracking-wide!"
        />
        <Primary
          href="#"
          text={saveLabel ?? "Next"}
          classname="h-12! text-lg! tracking-wide!"
          onClick={onSave}
          isDisabled={disableSave}
        />
      </div>
    </div>
  );
};

export default FormSection;
