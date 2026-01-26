import React from "react";
import EditableAccordion from "../Accordion/EditableAccordion";

import { InventoryItem } from "@/app/pages/Inventory/types";
import { BusinessType } from "@/app/types/org";
import {
  InventoryFormConfig,
  InventorySectionKey,
  ConfigItem,
  FieldDef,
} from "@/app/components/AddInventory/InventoryConfig";

type InfoSectionProps = {
  businessType: BusinessType;
  sectionKey: InventorySectionKey;
  sectionTitle: string;
  inventory: InventoryItem;
  onSaveSection?: (
    section: InventorySectionKey,
    values: Record<string, any>
  ) => Promise<void>;
  disableEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onRegisterActions?: (
    actions:
      | {
          save: () => Promise<void>;
          cancel: () => void;
          startEditing: () => void;
          isEditing: () => boolean;
        }
      | null
  ) => void;
};

type EditableField = {
  label: string;
  key: string;
  type: "text" | "select" | "date";
  options?: string[];
};

const InfoSection: React.FC<InfoSectionProps> = ({
  businessType,
  sectionKey,
  sectionTitle,
  inventory,
  onSaveSection,
  disableEditing = false,
  onEditingChange,
  onRegisterActions,
}) => {
  const configForBusiness = InventoryFormConfig[businessType] || {};
  const sectionConfig = configForBusiness[sectionKey];

  if (!sectionConfig || sectionConfig.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
        No fields configured for this section.
      </div>
    );
  }

  const data = inventory[sectionKey] as any;

  const toEditableField = (field: FieldDef<any>): EditableField => {
    const label = field.label || field.placeholder || field.name;
    let type: EditableField["type"];
    if (field.component === "dropdown") {
      type = "select";
    } else if (field.component === "date") {
      type = "date";
    } else {
      type = "text";
    }
    return {
      label,
      key: field.name,
      type,
      options: field.component === "dropdown" ? field.options : undefined,
    };
  };

  const flattenConfigToFields = (cfg: ConfigItem<any>[]): EditableField[] => {
    const result: EditableField[] = [];
    for (const item of cfg) {
      if (item.kind === "row") {
        for (const f of item.fields) {
          result.push(toEditableField(f));
        }
      } else {
        result.push(toEditableField(item.field));
      }
    }
    return result;
  };

  const fields = flattenConfigToFields(sectionConfig);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="font-grotesk text-black-text text-[23px] font-medium">
        {sectionTitle}
      </div>

      <EditableAccordion
        title={sectionTitle}
        fields={fields}
        data={data}
        defaultOpen={true}
        readOnly={disableEditing}
        showEditIcon={!disableEditing}
        onSave={(values) => onSaveSection?.(sectionKey, values)}
        hideInlineActions
        onEditingChange={onEditingChange}
        onRegisterActions={onRegisterActions}
      />
    </div>
  );
};

export default InfoSection;
