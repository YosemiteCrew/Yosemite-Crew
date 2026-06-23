'use client';
import React from 'react';
import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import ImageUploadField from '@/app/features/inventory/components/AddInventory/ImageUploadField';

import { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { BusinessType } from '@/app/features/organization/types/org';
import {
  InventoryFormConfig,
  InventorySectionKey,
  ConfigItem,
  FieldDef,
} from '@/app/features/inventory/components/AddInventory/InventoryConfig';

type InfoSectionProps = {
  businessType: BusinessType;
  sectionKey: InventorySectionKey;
  sectionTitle: string;
  inventory: InventoryItem;
  onSaveSection?: (section: InventorySectionKey, values: Record<string, any>) => Promise<void>;
  disableEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onRegisterActions?: (
    actions: {
      save: () => Promise<void>;
      cancel: () => void;
      startEditing: () => void;
      isEditing: () => boolean;
    } | null
  ) => void;
  stockLocationOptions?: string[];
  organisationId?: string;
};

type EditableField = {
  label: string;
  key: string;
  type: 'text' | 'select' | 'date' | 'multiSelect' | 'checkbox';
  options?: string[];
  editable?: boolean;
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
  stockLocationOptions,
  organisationId,
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

  const flattenFields = (cfg: ConfigItem<any>[]): FieldDef<any>[] => {
    const result: FieldDef<any>[] = [];
    for (const item of cfg) {
      if (item.kind === 'row') {
        for (const f of item.fields) result.push(f);
      } else {
        result.push(item.field);
      }
    }
    return result;
  };

  const allFields = flattenFields(sectionConfig);
  const uploadFields = allFields.filter((f) => f.component === 'upload');
  const nonUploadFields = allFields.filter((f) => f.component !== 'upload');

  const toEditableField = (field: FieldDef<any>): EditableField => {
    const label = field.label || field.placeholder || field.name;
    let type: EditableField['type'];
    if (field.component === 'dropdown') {
      type = 'select';
    } else if (field.component === 'multiSelect') {
      type = 'multiSelect';
    } else if (field.component === 'checkbox') {
      type = 'checkbox';
    } else if (field.component === 'date') {
      type = 'date';
    } else {
      type = 'text';
    }
    const resolvedOptions =
      sectionKey === 'stock' &&
      field.name === 'stockLocation' &&
      stockLocationOptions &&
      stockLocationOptions.length > 0
        ? stockLocationOptions
        : field.options;

    return {
      label,
      key: field.name,
      type,
      options:
        field.component === 'dropdown' || field.component === 'multiSelect'
          ? resolvedOptions
          : undefined,
      ...(field.readonly ? { editable: false } : {}),
    };
  };

  const accordionFields = nonUploadFields.map(toEditableField);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="font-satoshi text-black-text text-[23px] font-medium">{sectionTitle}</div>

      {accordionFields.length > 0 && (
        <EditableAccordion
          title={sectionTitle}
          fields={accordionFields}
          data={data}
          defaultOpen={true}
          readOnly={disableEditing}
          showEditIcon={!disableEditing}
          onSave={(values) => onSaveSection?.(sectionKey, values)}
          hideInlineActions
          onEditingChange={onEditingChange}
          onRegisterActions={onRegisterActions}
          footer={
            uploadFields.length > 0 ? (
              <div className="flex flex-col gap-3">
                {uploadFields.map((field) => (
                  <ImageUploadField
                    key={field.name}
                    label={field.placeholder || field.label}
                    value={data?.[field.name] ?? ''}
                    organisationId={organisationId}
                    onChange={(url) =>
                      !disableEditing && onSaveSection?.(sectionKey, { [field.name]: url })
                    }
                  />
                ))}
              </div>
            ) : undefined
          }
        />
      )}
    </div>
  );
};

export default InfoSection;
