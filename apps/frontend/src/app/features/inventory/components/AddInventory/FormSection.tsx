import React from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import Datepicker from '@/app/ui/inputs/Datepicker';
import { BusinessType } from '@/app/features/organization/types/org';
import ImageUploadField from '@/app/features/inventory/components/AddInventory/ImageUploadField';

import {
  InventoryItem,
  InventoryErrors,
  getSubCategoryOptions,
} from '@/app/features/inventory/pages/Inventory/types';
import {
  InventoryFormConfig,
  ConfigItem,
  FieldDef,
  InventorySectionKey,
} from '@/app/features/inventory/components/AddInventory/InventoryConfig';
import {
  formatCurrencyValue,
  formatPercentValue,
  getAvailableStock,
  getGrossProfitPerUnit,
  getMarginPercent,
  getStockValue,
  toNumberSafe,
} from '@/app/features/inventory/pages/Inventory/utils';

const parseDate = (value?: string): Date | null => {
  if (!value) return null;

  if (value.includes('/')) {
    const [dd, mm, yyyy] = value.split('/');
    const parsed = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    const parsed = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

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
  stockLocationOptions?: string[];
  headerSlot?: React.ReactNode;
  organisationId?: string;
};

const PricingSummary = ({ formData }: { formData: InventoryItem }) => (
  <div className="flex flex-col gap-2 px-4 text-body-4 text-text-primary">
    <div>
      <span>Gross profit per unit : </span>
      <span className="rounded-full bg-badge-blue-bg px-2 font-semibold text-badge-blue-text">
        {formatCurrencyValue(getGrossProfitPerUnit(formData), formData.currency)}
      </span>
    </div>
    <div className="mb-4">
      <span>Margin : </span>
      <span className="rounded-full bg-badge-blue-bg px-2 font-semibold text-badge-blue-text">
        {formatPercentValue(getMarginPercent(formData))}
      </span>
    </div>
    <div className="relative rounded-2xl border border-input-border-default px-6 py-3 min-h-12">
      <span className="absolute left-4 -top-[11px] bg-white px-1.5 text-xs text-input-text-placeholder">
        Total stock value
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="text-body-4 text-text-primary">
          {formatCurrencyValue(getStockValue(formData), formData.currency)}
        </span>
        <span className="text-caption-1 text-text-extra whitespace-nowrap">
          on-hand stock x unit cost
        </span>
      </div>
    </div>
  </div>
);

const drugOnlyClassificationFields = new Set([
  'genericName',
  'drugSchedule',
  'form',
  'administration',
  'strength',
  'unitofMeasure',
  'controlledSubstance',
  'prescriptionRequired',
  'reportableToGovernment',
]);

const drugOnlyBatchFields = new Set(['tracking']);

const drugOnlyStockFields = new Set(['withdrawlPeriod']);

const isDrugOnlyField = (
  sectionKey: InventorySectionKey,
  isNonDrug: boolean,
  fieldName: string
): boolean => {
  if (!isNonDrug) return false;
  if (sectionKey === 'classification') return drugOnlyClassificationFields.has(fieldName);
  if (sectionKey === 'batch') return drugOnlyBatchFields.has(fieldName);
  if (sectionKey === 'stock') return drugOnlyStockFields.has(fieldName);
  return false;
};

type DropdownOption = string | { label: string; value: string };

type FieldChangeHandler = (
  field: FieldDef<any>,
  value: string | string[],
  batchIndex?: number
) => void;

type InventoryFieldRenderParams = {
  field: FieldDef<any>;
  key?: React.Key;
  index?: number;
  sectionKey: InventorySectionKey;
  formData: InventoryItem;
  sectionData: any;
  sectionErrors: any;
  stockLocationOptions?: string[];
  organisationId?: string;
  handleChange: FieldChangeHandler;
};

const getResolvedDropdownOptions = (
  sectionKey: InventorySectionKey,
  fieldName: string,
  stockLocationOptions: DropdownOption[] | undefined,
  sectionCategory: string | undefined,
  options: DropdownOption[] | undefined
) => {
  if (sectionKey === 'stock' && fieldName === 'stockLocation' && stockLocationOptions?.length) {
    return stockLocationOptions;
  }
  if (fieldName === 'subCategory') {
    return getSubCategoryOptions(sectionCategory);
  }
  return options || [];
};

const getMultiSelectValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value);
    if (!text) return [];
    return text.split(',').map((v) => v.trim());
  }
  return [];
};

const getReadOnlyStockDisplayValue = (
  field: FieldDef<any>,
  formData: InventoryItem,
  value: unknown
): string => {
  if (field.name === 'available') {
    return String(getAvailableStock(formData) ?? toNumberSafe(value) ?? '0');
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value || '0');
  }
  return '0';
};

const renderTextInventoryField = ({
  field,
  key,
  index,
  sectionKey,
  formData,
  value,
  error,
  handleChange,
}: {
  field: FieldDef<any>;
  key?: React.Key;
  index?: number;
  sectionKey: InventorySectionKey;
  formData: InventoryItem;
  value: any;
  error: any;
  handleChange: FieldChangeHandler;
}) => {
  const isReadOnlyStockField = sectionKey === 'stock' && field.readonly;
  if (isReadOnlyStockField) {
    const displayValue = getReadOnlyStockDisplayValue(field, formData, value);
    return (
      <div
        key={key ?? field.name}
        className="flex items-center gap-2 px-2 text-body-4 text-text-primary"
      >
        <span>{field.placeholder} :</span>
        <span className="rounded-full bg-badge-blue-bg px-2 font-semibold text-badge-blue-text">
          {displayValue}
        </span>
      </div>
    );
  }

  return (
    <FormInput
      key={key ?? field.name}
      intype="text"
      inname={field.name}
      value={value}
      inlabel={field.placeholder || ''}
      onChange={(e) => {
        const raw = e.target.value;
        const val = field.numeric ? raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1') : raw;
        handleChange(field, val, index);
      }}
      error={error}
      className="min-h-12!"
    />
  );
};

const renderInventoryField = ({
  field,
  key,
  index,
  sectionKey,
  formData,
  sectionData,
  sectionErrors,
  stockLocationOptions,
  organisationId,
  handleChange,
}: InventoryFieldRenderParams) => {
  const { placeholder, component, options } = field;
  const isBatch = sectionKey === 'batch' && typeof index === 'number';
  const value = isBatch
    ? ((formData.batches?.[index] as any)?.[field.name] ?? '')
    : (sectionData?.[field.name] ?? '');
  const error = sectionErrors?.[field.name];

  const isNonDrug = String(formData.classification?.itemType ?? '').toLowerCase() === 'non-drug';

  if (isDrugOnlyField(sectionKey, isNonDrug, String(field.name))) return null;

  if (component === 'text') {
    return renderTextInventoryField({
      field,
      key,
      index,
      sectionKey,
      formData,
      value,
      error,
      handleChange,
    });
  }

  if (component === 'date') {
    const currentDate = parseDate(value);
    return (
      <div key={key ?? field.name} className="flex flex-col gap-1">
        <Datepicker
          currentDate={currentDate}
          setCurrentDate={(next: Date | null | ((prev: Date | null) => Date | null)) => {
            const resolved = typeof next === 'function' ? next(currentDate) : next;
            handleChange(field, resolved ? formatDate(resolved) : '', index);
          }}
          placeholder={placeholder || ''}
          type="input"
          className="min-h-12!"
          error={error}
        />
      </div>
    );
  }

  if (component === 'dropdown') {
    const resolvedOptions = getResolvedDropdownOptions(
      sectionKey,
      field.name,
      stockLocationOptions,
      sectionData?.category,
      options
    );
    const dropdownOptions = resolvedOptions.map((opt) =>
      typeof opt === 'string' ? { label: opt, value: opt } : opt
    );
    return (
      <LabelDropdown
        key={key ?? field.name}
        placeholder={placeholder || ''}
        defaultOption={value}
        onSelect={(opt) => handleChange(field, opt.value, index)}
        error={error}
        options={dropdownOptions}
      />
    );
  }

  if (component === 'multiSelect') {
    const arrayValue = getMultiSelectValues(value);
    return (
      <MultiSelectDropdown
        key={key ?? field.name}
        placeholder={placeholder || ''}
        value={arrayValue}
        onChange={(vals) => handleChange(field, vals, index)}
        error={error}
        options={options || []}
      />
    );
  }

  if (component === 'textarea') {
    return (
      <FormDesc
        key={key ?? field.name}
        intype="text"
        inname={field.name}
        value={value}
        inlabel={placeholder || ''}
        onChange={(e) => handleChange(field, e.target.value, index)}
        className="min-h-[120px]!"
      />
    );
  }

  if (component === 'checkbox') {
    const checked = value === 'true' || value === 'Yes';
    return (
      <label
        key={key ?? field.name}
        className="flex min-h-10 cursor-pointer items-center gap-3 text-body-4 text-text-primary"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => handleChange(field, e.target.checked ? 'true' : 'false', index)}
          className="size-5 rounded border-input-border-default accent-blue-text"
        />
        <span>{placeholder}</span>
      </label>
    );
  }

  if (component === 'upload') {
    return (
      <ImageUploadField
        key={key ?? field.name}
        label={placeholder}
        value={value}
        organisationId={organisationId}
        onChange={(url) => handleChange(field, url, index)}
      />
    );
  }

  return null;
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
  stockLocationOptions,
  headerSlot,
  organisationId,
}) => {
  const configForBusiness = InventoryFormConfig[businessType] ?? {};
  const sectionConfig = configForBusiness[sectionKey];

  if (!sectionConfig || sectionConfig.length === 0) {
    return <div className="text-sm text-gray-500">No fields configured.</div>;
  }

  const sectionData = formData[sectionKey] as any;
  const sectionErrors = (errors as Record<InventorySectionKey, any>)[sectionKey];

  const handleChange = (field: FieldDef<any>, value: string | string[], batchIndex?: number) => {
    onFieldChange(sectionKey, field.name, value, batchIndex);
  };

  const renderField = (field: FieldDef<any>, key?: React.Key, index?: number) =>
    renderInventoryField({
      field,
      key,
      index,
      sectionKey,
      formData,
      sectionData,
      sectionErrors,
      stockLocationOptions,
      organisationId,
      handleChange,
    });

  const renderItem = (item: ConfigItem<any>, index: number, batchIndex?: number) => {
    const itemKey =
      item.kind === 'row' ? item.fields.map((field) => field.name).join('-') : item.field.name;
    const fullKey = batchIndex === undefined ? itemKey : `${batchIndex}-${itemKey}`;
    if ('fields' in item && item.kind === 'row') {
      return (
        <div key={fullKey} className="grid grid-cols-2 gap-3">
          {item.fields.map((field, i) => renderField(field, `${index}-${i}`, batchIndex))}
        </div>
      );
    }

    return (
      <div key={fullKey} className="w-full">
        {renderField(item.field, index, batchIndex)}
      </div>
    );
  };

  return (
    <div className="flex w-full flex-1 flex-col justify-between gap-6">
      <div className="flex flex-col gap-6">
        <div className="font-satoshi text-black-text text-[23px] font-medium">{sectionTitle}</div>

        <Accordion title={sectionTitle} defaultOpen showEditIcon={false} isEditing={true}>
          {sectionKey === 'batch' ? (
            <div className="flex flex-col gap-6">
              {(formData.batches && formData.batches.length > 0
                ? formData.batches
                : [formData.batch]
              ).map((batch, batchIdx) => (
                <div
                  key={batch._id ?? `batch-${batchIdx}`}
                  className="flex flex-col gap-3 border border-grey-light rounded-xl p-3"
                >
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
                    {sectionConfig.map((item, index) => renderItem(item, index, batchIdx))}
                  </div>
                </div>
              ))}
              <Secondary
                href="#"
                text="Add another batch"
                onClick={() => onAddBatch?.()}
                className="w-full! h-12! text-body-3-emphasis! font-satoshi font-semibold!"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {headerSlot}
              {sectionConfig.map((item, index) => renderItem(item, index))}
              {sectionKey === 'pricing' && <PricingSummary formData={formData} />}
            </div>
          )}
        </Accordion>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-3 pb-3">
        <Secondary
          href="#"
          text="Clear"
          onClick={onClear}
          isDisabled={disableSave}
          className="h-12! text-lg! tracking-[-0.36px]!"
        />
        <Primary
          href="#"
          text={saveLabel ?? 'Next'}
          className="h-12! text-lg! tracking-[-0.36px]!"
          onClick={onSave}
          isDisabled={disableSave}
        />
      </div>
    </div>
  );
};

export default FormSection;
