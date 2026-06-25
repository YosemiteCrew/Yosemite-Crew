import { Primary } from '@/app/ui/primitives/Buttons';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import {
  FormField,
  FormFieldType,
  FormsProps,
  buildMedicationFields,
} from '@/app/features/forms/types/forms';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import Dropdown from '@/app/ui/inputs/Dropdown/Dropdown';
import React, { useEffect, useRef, useState } from 'react';
import { IoIosAddCircleOutline, IoIosWarning } from 'react-icons/io';
import TextBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Text/TextBuilder';
import RichTextBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/RichText/RichTextBuilder';
import InputBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Input/InputBuilder';
import DropdownBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Dropdown/DropdownBuilder';
import SignatureBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Signature/SignatureBuilder';
import BuilderWrapper, {
  StructureLockContext,
} from '@/app/features/forms/pages/Forms/Sections/AddForm/components/BuildWrapper';
import BooleanBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Boolean/BooleanBuilder';
import DateBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Date/DateBuilder';
import { useOrgStore } from '@/app/stores/orgStore';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import { InventoryApiItem } from '@/app/features/inventory/pages/Inventory/types';
import { mapApiItemToInventoryItem } from '@/app/features/inventory/pages/Inventory/utils';
import { ensureSingleSignatureAtEnd, hasSignatureField } from '@/app/lib/forms';

// Builds a nested-field updater for a group field. Shared by the service/medication/task
// group builders so their (otherwise identical) update handlers aren't duplicated.
const makeNestedFieldUpdater =
  (
    group: FormField & { type: 'group'; fields?: FormField[] },
    onChange: (next: FormField) => void
  ) =>
  (id: string, updatedField: FormField): void => {
    onChange({
      ...group,
      fields: (group.fields ?? []).map((f) => (f.id === id ? updatedField : f)),
    });
  };

type BuildProps = {
  formData: FormsProps;
  setFormData: React.Dispatch<React.SetStateAction<FormsProps>>;
  onNext: () => void;
  serviceOptions: { label: string; value: string; badge?: string }[];
  registerValidator?: (fn: () => boolean) => void;
};

type OptionKey = FormFieldType | 'medication' | 'service-group' | 'task-group';

type OptionProp = {
  name: string;
  key: OptionKey;
};

const addOptions: OptionProp[] = [
  {
    name: 'Long Text',
    key: 'textarea',
  },
  {
    name: 'Rich Text',
    key: 'richtext',
  },
  {
    name: 'Short Text',
    key: 'input',
  },
  {
    name: 'Number',
    key: 'number',
  },
  {
    name: 'Select List',
    key: 'dropdown',
  },
  {
    name: 'Single Choice',
    key: 'radio',
  },
  {
    name: 'Multiple Choice',
    key: 'checkbox',
  },
  {
    name: 'Yes / No',
    key: 'boolean',
  },
  {
    name: 'Date',
    key: 'date',
  },
  {
    name: 'Signature',
    key: 'signature',
  },
  {
    name: 'Field Group',
    key: 'group',
  },
  {
    name: 'Medications',
    key: 'medication',
  },
  {
    name: 'Services / Packages',
    key: 'service-group',
  },
  {
    name: 'Tasks',
    key: 'task-group',
  },
];

type BuilderComponentProps = {
  field: FormField;
  onChange: (f: FormField) => void;
  createField?: (t: OptionKey) => FormField;
};

const builderComponentMap: Record<FormFieldType, React.ComponentType<BuilderComponentProps>> = {
  textarea: TextBuilder as any,
  richtext: RichTextBuilder as any,
  input: InputBuilder as any,
  number: InputBuilder as any,
  dropdown: DropdownBuilder as any,
  radio: DropdownBuilder as any,
  checkbox: DropdownBuilder as any,
  boolean: BooleanBuilder as any,
  date: DateBuilder as any,
  signature: SignatureBuilder as any,
  group: (() => null) as any, // Placeholder; handled inline
};

const defaultDropdownOptions = [
  { label: 'Option 1', value: 'option_1' },
  { label: 'Option 2', value: 'option_2' },
];

const defaultRadioOptions = [
  { label: 'Option A', value: 'option_a' },
  { label: 'Option B', value: 'option_b' },
];

const MEDICINE_INVENTORY_CATEGORIES = new Set([
  'medicine',
  'vaccine',
  'supplement',
  'iv/fluid therapy',
]);

const isMedicineInventoryItem = (item: InventoryApiItem): boolean => {
  const normalized = mapApiItemToInventoryItem(item);
  const category = `${normalized.basicInfo.category ?? item.category ?? ''}`.trim().toLowerCase();
  const itemType =
    `${normalized.classification.itemType ?? normalized.basicInfo.itemType ?? item.itemType ?? ''}`
      .trim()
      .toLowerCase();
  return (
    MEDICINE_INVENTORY_CATEGORIES.has(category) || itemType === 'drug' || itemType === 'medical'
  );
};

const buildMedicationTemplateGroup = (id: string): FormField => {
  const templateId = `${id}_template`;
  return {
    id: templateId,
    type: 'group',
    label: 'Medication template',
    meta: { template: true, medicineName: 'Medication template' } as any,
    fields: buildMedicationFields(templateId, '-'),
  };
};

const defaultTaskBlockFields = (prefix: string, taskNumber: number): FormField[] => [
  {
    id: `${prefix}_name`,
    type: 'input',
    label: 'Task name',
    placeholder: 'e.g. Check vitals',
    defaultValue: '',
    meta: { taskBlockKey: 'name' },
  },
  {
    id: `${prefix}_dayOffset`,
    type: 'number',
    label: 'Day after start',
    placeholder: '0',
    defaultValue: String(taskNumber - 1),
    meta: { taskBlockKey: 'dayOffset' },
  },
  {
    id: `${prefix}_timeOfDay`,
    type: 'input',
    label: 'Time',
    placeholder: '09:00',
    defaultValue: '09:00',
    meta: { taskBlockKey: 'timeOfDay' },
  },
  {
    id: `${prefix}_reminderOffsetMinutes`,
    type: 'number',
    label: 'Reminder before (minutes)',
    placeholder: '15',
    meta: { taskBlockKey: 'reminderOffsetMinutes' },
  },
  {
    id: `${prefix}_additionalNotes`,
    type: 'textarea',
    label: 'Instructions',
    placeholder: 'What should be done for this task',
    meta: { taskBlockKey: 'additionalNotes' },
  },
];

const fieldFactory: Record<
  OptionKey,
  (id: string, serviceOptions?: { label: string; value: string }[]) => FormField
> = {
  medication: (id) => ({
    id,
    type: 'group',
    label: 'Medication',
    meta: { medicationGroup: true } as any,
    fields: [buildMedicationTemplateGroup(id)],
  }),
  textarea: (id) => ({ id, type: 'textarea', label: 'Text area', placeholder: '' }),
  richtext: (id) => ({ id, type: 'richtext', label: 'Rich text', defaultValue: '' }),
  input: (id) => ({ id, type: 'input', label: 'Input', placeholder: '' }),
  number: (id) => ({ id, type: 'number', label: 'Number', placeholder: '' }),
  dropdown: (id) => ({
    id,
    type: 'dropdown',
    label: 'Dropdown',
    options: defaultDropdownOptions.map((option) => ({ ...option })),
    multiple: false,
  }),
  radio: (id) => ({
    id,
    type: 'radio',
    label: 'Radio',
    options: defaultRadioOptions.map((option) => ({ ...option })),
    multiple: false,
  }),
  checkbox: (id) => ({
    id,
    type: 'checkbox',
    label: 'Checkbox',
    options: defaultDropdownOptions.map((option) => ({ ...option })),
    multiple: true,
  }),
  boolean: (id) => ({ id, type: 'boolean', label: 'Yes / No' }),
  date: (id) => ({ id, type: 'date', label: 'Date' }),
  signature: (id) => ({ id, type: 'signature', label: 'Signature' }),
  group: (id) => ({ id, type: 'group', label: 'Group', fields: [] }),
  'service-group': (id) => ({
    id,
    type: 'group',
    label: 'Services / Packages',
    meta: { serviceGroup: true } as any,
    fields: [],
  }),
  'task-group': (id) => ({
    id,
    type: 'group',
    label: 'Tasks',
    meta: { taskGroup: true } as any,
    fields: [],
  }),
};

const AddFieldDropdown: React.FC<{
  onSelect: (key: OptionKey) => void;
  buttonClassName?: string;
  options?: OptionProp[];
}> = ({ onSelect, buttonClassName, options = addOptions }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(dropdownRef, () => setOpen(false));

  return (
    <div className={`relative ${buttonClassName ?? ''}`} ref={dropdownRef}>
      <IoIosAddCircleOutline
        size={28}
        color="var(--color-neutral-900)"
        onClick={() => setOpen((e) => !e)}
        className="cursor-pointer"
      />
      {open && (
        <div className="absolute top-[120%] z-10 right-0 rounded-2xl border border-grey-noti bg-white shadow-md! flex flex-col items-center w-[160px]">
          {options.map((option, i) => (
            <button
              type="button"
              key={option.key}
              onClick={() => {
                onSelect(option.key);
                setOpen(false);
              }}
              className={`${i === 0 ? 'border-t-0!' : 'border-t! border-t-grey-light!'} font-satoshi font-medium text-[16px] text-black-text text-left px-3 py-2 w-full`}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const isTreatmentPlanGroup = (field: FormField): field is FormField & { type: 'group' } =>
  field.id === 'treatment_plan' && field.type === 'group';

const isMedicationGroup = (field: FormField): field is FormField & { type: 'group' } =>
  field.type === 'group' && Boolean(field.meta?.medicationGroup);

const isServiceGroup = (field: FormField): field is FormField & { type: 'group' } =>
  field.type === 'group' && Boolean(field.meta?.serviceGroup);

const isTaskGroup = (field: FormField): field is FormField & { type: 'group' } =>
  field.type === 'group' && Boolean(field.meta?.taskGroup);

const getServiceCheckbox = (
  field: FormField & { type: 'group'; fields?: FormField[] }
): (FormField & { type: 'checkbox'; options?: { label: string; value: string }[] }) | undefined =>
  (field.fields ?? []).find(
    (f): f is FormField & { type: 'checkbox'; options?: { label: string; value: string }[] } =>
      f.type === 'checkbox'
  );

const ensureServiceCheckbox = (
  field: FormField & { type: 'group' },
  serviceOptions: { label: string; value: string; badge?: string }[]
): { group: FormField & { type: 'group' }; selected: string[] } => {
  const existingCheckbox = getServiceCheckbox(field);
  const selected = existingCheckbox?.options?.map((opt) => opt.value) ?? [];

  const nextMeta = field.meta
    ? { ...field.meta, serviceGroup: true, serviceIds: selected }
    : { serviceGroup: true, serviceIds: selected };

  const checkbox: FormField = {
    id: existingCheckbox?.id || `${field.id}_services`,
    type: 'checkbox',
    label: '', // Empty label to avoid duplicate "Services" text
    options: selected.map((val) => {
      const match = serviceOptions.find((o) => o.value === val);
      return match ?? { label: val, value: val };
    }),
    multiple: true,
    meta: existingCheckbox?.meta
      ? { ...existingCheckbox.meta, serviceIds: selected }
      : { serviceIds: selected },
  };

  const otherFields = (field.fields ?? []).filter((f) => f.id !== checkbox.id);

  return {
    group: {
      ...field,
      meta: nextMeta,
      fields: [...otherFields, checkbox],
    },
    selected,
  };
};

const buildLabeledMedication = (fields: FormField[] | undefined, baseMedication: FormField) => {
  const medCount = (fields ?? []).filter(isMedicationGroup).length;
  return { ...baseMedication, label: `Medication ${medCount + 1}` };
};

const addMedicationToTreatmentPlan = (schema: FormField[], medicationField: FormField) =>
  schema.map((field) => {
    if (!isTreatmentPlanGroup(field)) return field;
    const labeledMed = buildLabeledMedication(field.fields, medicationField);
    return { ...field, fields: [...(field.fields ?? []), labeledMed] };
  });

const useOutsideClick = (ref: React.RefObject<HTMLElement | null>, onClose: () => void) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onCloseRef.current();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref]);
};

export const FieldBuilder: React.FC<{
  field: FormField;
  onChange: (f: FormField) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  createField: (t: OptionKey) => FormField;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
  contentDeletable?: boolean;
}> = ({
  field,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  createField,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  contentDeletable,
}) => {
  const Component = builderComponentMap[field.type];

  return (
    <BuilderWrapper
      field={field}
      onDelete={onDelete}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
      contentDeletable={contentDeletable}
    >
      <Component field={field} onChange={onChange} createField={createField} />
    </BuilderWrapper>
  );
};

type GroupBuilderProps = {
  field: FormField & { type: 'group'; fields?: FormField[] };
  onChange: (f: FormField) => void;
  createField: (t: OptionKey) => FormField;
  serviceOptions: { label: string; value: string; badge?: string }[];
};

const GroupBuilder: React.FC<GroupBuilderProps> = ({
  field,
  onChange,
  createField,
  serviceOptions,
}) => {
  const structureLocked = React.useContext(StructureLockContext);
  const groupField: FormField & { type: 'group'; fields?: FormField[] } = {
    ...field,
    fields: field.fields ?? [],
  };

  if (isServiceGroup(field)) {
    const { group, selected } = ensureServiceCheckbox(groupField, serviceOptions);
    const checkbox = getServiceCheckbox(group);

    const updateOptions = (values: string[]) => {
      const nextCheckbox = {
        ...checkbox,
        options: values.map((val) => {
          const match = serviceOptions.find((o) => o.value === val);
          return match ?? { label: val, value: val };
        }),
        meta: checkbox?.meta ? { ...checkbox.meta, serviceIds: values } : { serviceIds: values },
      };
      onChange({
        ...group,
        meta: group.meta ? { ...group.meta, serviceIds: values } : { serviceIds: values },
        fields: (group.fields ?? []).map((f) =>
          f.id === checkbox?.id ? (nextCheckbox as FormField) : f
        ),
      });
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="font-satoshi text-black-text text-[18px] font-medium">
            {group.label || 'Services / Packages'}
          </div>
        </div>
        {!structureLocked && (
          <FormInput
            intype="text"
            inname={`group-${group.id}-label`}
            value={group.label || ''}
            inlabel="Group name"
            onChange={(e) => onChange({ ...group, label: e.target.value })}
            className="min-h-12!"
          />
        )}
        <MultiSelectDropdown
          placeholder="Select services / packages"
          value={selected}
          onChange={updateOptions}
          options={serviceOptions}
        />
      </div>
    );
  }

  const updateNestedField = makeNestedFieldUpdater(groupField, onChange);

  const removeNestedField = (id: string) =>
    onChange({
      ...groupField,
      fields: (groupField.fields ?? []).filter((f) => f.id !== id),
    });

  const addNestedField = (key: OptionKey) => {
    const newField = createField(key);
    onChange({
      ...groupField,
      fields: [...(groupField.fields ?? []), newField],
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="font-satoshi text-black-text text-[18px] font-medium">
          {groupField.label || 'Group'}
        </div>
        {!structureLocked && <AddFieldDropdown onSelect={addNestedField} />}
      </div>

      {!structureLocked && (
        <FormInput
          intype="text"
          inname={`group-${groupField.id}-label`}
          value={groupField.label || ''}
          inlabel="Group name"
          onChange={(e) => onChange({ ...groupField, label: e.target.value })}
          className="min-h-12!"
        />
      )}

      {(groupField.fields ?? []).map((nested) => {
        if (nested.type === 'group') {
          // Check if this is a medication group
          if (isMedicationGroup(nested)) {
            return (
              <BuilderWrapper
                key={nested.id}
                field={nested}
                onDelete={() => removeNestedField(nested.id)}
                compact
              >
                <MedicationGroupBuilder
                  field={nested}
                  onChange={(updated) => updateNestedField(nested.id, updated)}
                  createField={createField}
                />
              </BuilderWrapper>
            );
          }

          if (isTaskGroup(nested)) {
            return (
              <BuilderWrapper
                key={nested.id}
                field={nested}
                onDelete={() => removeNestedField(nested.id)}
                compact
              >
                <TaskGroupBuilder
                  field={nested}
                  onChange={(updated) => updateNestedField(nested.id, updated)}
                  createField={createField}
                />
              </BuilderWrapper>
            );
          }

          // Regular nested groups
          return (
            <BuilderWrapper
              key={nested.id}
              field={nested}
              onDelete={() => removeNestedField(nested.id)}
              compact
            >
              <GroupBuilder
                field={nested}
                onChange={(updated) => updateNestedField(nested.id, updated)}
                createField={createField}
                serviceOptions={serviceOptions}
              />
            </BuilderWrapper>
          );
        }

        return (
          <FieldBuilder
            key={nested.id}
            field={nested}
            onChange={(updated) => updateNestedField(nested.id, updated)}
            onDelete={() => removeNestedField(nested.id)}
            createField={createField}
          />
        );
      })}
    </div>
  );
};

const renderMedicineField = (
  medField: FormField,
  nested: FormField & { fields?: FormField[] },
  updateNestedField: (id: string, updated: FormField) => void,
  createField: (t: OptionKey) => FormField
) => {
  const Component = builderComponentMap[medField.type];
  if (!Component) return null;

  return (
    <div key={medField.id} className="relative">
      <Component
        field={medField}
        onChange={(updated) => {
          const updatedNested = {
            ...nested,
            fields: (nested.fields ?? []).map((f: FormField) =>
              f.id === medField.id ? updated : f
            ),
          };
          updateNestedField(nested.id, updatedNested);
        }}
        createField={createField}
      />
      {medField.meta?.readonly && (
        <div className="absolute top-2 right-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          Read-only
        </div>
      )}
    </div>
  );
};

const renderNestedField = (
  nested: FormField,
  updateNestedField: (id: string, updated: FormField) => void,
  removeMedicine: (id: string) => void,
  createField: (t: OptionKey) => FormField
) => {
  // Medicine groups and task fields are content the author added to the template, so they can be
  // removed even when the structure is locked (YC-default).
  const isContentItem = Boolean(
    (
      nested.meta as
        | { inventoryItemId?: string; medicineId?: string; taskId?: string; taskBlock?: boolean }
        | undefined
    )?.inventoryItemId ||
    (nested.meta as { medicineId?: string } | undefined)?.medicineId ||
    (nested.meta as { taskId?: string } | undefined)?.taskId ||
    (nested.meta as { taskBlock?: boolean } | undefined)?.taskBlock
  );
  if (nested.type === 'group') {
    const groupField = nested as FormField & { fields?: FormField[] };
    return (
      <BuilderWrapper
        key={nested.id}
        field={nested}
        onDelete={() => removeMedicine(nested.id)}
        contentDeletable={isContentItem}
        compact
      >
        <div className="flex flex-col gap-3">
          <div className="font-satoshi text-black-text text-[16px] font-medium">{nested.label}</div>
          {(groupField.fields ?? []).map((medField) =>
            renderMedicineField(medField, groupField, updateNestedField, createField)
          )}
        </div>
      </BuilderWrapper>
    );
  }

  return (
    <FieldBuilder
      key={nested.id}
      field={nested}
      onChange={(updated) => updateNestedField(nested.id, updated)}
      onDelete={() => removeMedicine(nested.id)}
      contentDeletable={isContentItem}
      createField={createField}
    />
  );
};

type MedicationGroupBuilderProps = {
  field: FormField & { type: 'group'; fields?: FormField[] };
  onChange: (f: FormField) => void;
  createField: (t: OptionKey) => FormField;
};

const MedicationGroupBuilder: React.FC<MedicationGroupBuilderProps> = ({
  field,
  onChange,
  createField,
}) => {
  const structureLocked = React.useContext(StructureLockContext);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const [medicines, setMedicines] = useState<InventoryApiItem[]>([]);
  const [selectedMedicines, setSelectedMedicines] = useState<string[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);

  useEffect(() => {
    if (!primaryOrgId) return;
    setLoadingMedicines(true);
    fetchInventoryItems(primaryOrgId)
      .then((items) => setMedicines(items.filter(isMedicineInventoryItem)))
      .catch((err) => console.error('Failed to load medicines:', err))
      .finally(() => setLoadingMedicines(false));
  }, [primaryOrgId]);

  const medicineOptions = medicines.map((med) => {
    const normalized = mapApiItemToInventoryItem(med);
    const label =
      normalized.basicInfo.name || normalized.classification.genericName || med.name || 'Medicine';
    const strength = normalized.classification.strength || normalized.classification.dosageForm;
    const route = normalized.classification.administration;
    const parts = [strength, route].filter(Boolean).join(' • ');
    return {
      label: parts ? `${label} (${parts})` : label,
      value: med._id,
      badge: normalized.basicInfo.itemType || 'Drug',
    };
  });

  const handleMedicineSelect = (medicineId: string) => {
    if (!medicineId || selectedMedicines.includes(medicineId)) return;

    const medicine = medicines.find((m) => m._id === medicineId);
    if (!medicine) return;
    const normalizedMedicine = mapApiItemToInventoryItem(medicine);
    const inventoryItemId = medicine._id;

    // Create individual medication fields directly (not a nested group)
    const medicineCount = (field.fields ?? []).length + 1;
    const fieldPrefix = `${field.id}_med_${medicineCount}`;

    // Read inventory-sourced values from the canonical API fields (top-level), falling back to the
    // legacy `attributes` bag. These prefill the read-only name/strength/route/price; the author
    // fills frequency/duration/qty/remark defaults which preload the workspace prescription section.
    const strength =
      normalizedMedicine.classification.strength ||
      normalizedMedicine.classification.dosageForm ||
      '';
    const route = normalizedMedicine.classification.administration || '';
    const price = normalizedMedicine.pricing.selling || '';
    const displayName =
      normalizedMedicine.basicInfo.name ||
      normalizedMedicine.classification.genericName ||
      medicine.name ||
      'Medicine';
    const medicationFields: FormField[] = [
      {
        id: `${fieldPrefix}_name`,
        type: 'input',
        label: 'Name',
        placeholder: displayName,
        defaultValue: displayName,
        meta: { readonly: true, inventoryItemId },
      },
      {
        id: `${fieldPrefix}_dosage`,
        type: 'input',
        label: 'Strength',
        placeholder: strength || 'Strength from inventory',
        defaultValue: strength,
        meta: { readonly: true, inventoryItemId },
      },
      {
        id: `${fieldPrefix}_route`,
        type: 'input',
        label: 'Route',
        placeholder: route || 'Route from inventory',
        defaultValue: route,
        meta: { readonly: true, inventoryItemId },
      },
      {
        id: `${fieldPrefix}_frequency`,
        type: 'input',
        label: 'Frequency',
        placeholder: 'Enter frequency',
        meta: { inventoryItemId },
      },
      {
        id: `${fieldPrefix}_duration`,
        type: 'input',
        label: 'Duration',
        placeholder: 'Enter duration',
        meta: { inventoryItemId },
      },
      {
        id: `${fieldPrefix}_qty`,
        type: 'number',
        label: 'Quantity',
        placeholder: 'Units to dispense',
        meta: { inventoryItemId },
      },
      {
        id: `${fieldPrefix}_price`,
        type: 'number',
        label: 'Price',
        placeholder: price,
        defaultValue: price,
        meta: { readonly: true, inventoryItemId },
      },
      {
        id: `${fieldPrefix}_remark`,
        type: 'textarea',
        label: 'Instructions',
        placeholder: 'Add instructions',
        meta: { inventoryItemId },
      },
    ];

    // Create a group for this specific medicine
    const newMedicineGroup: FormField = {
      id: `${fieldPrefix}_group`,
      type: 'group',
      label: displayName,
      fields: medicationFields,
      meta: {
        medicineId,
        inventoryItemId,
        medicineName: displayName,
      },
    };

    setSelectedMedicines([...selectedMedicines, medicineId]);
    onChange({
      ...field,
      fields: [...(field.fields ?? []), newMedicineGroup],
    });
  };

  const removeMedicine = (medFieldId: string) => {
    const medField = (field.fields ?? []).find((f) => f.id === medFieldId);
    if (medField) {
      const medicineId = (medField as any).meta?.medicineId;
      if (medicineId) {
        setSelectedMedicines(selectedMedicines.filter((id) => id !== medicineId));
      }
    }
    onChange({
      ...field,
      fields: (field.fields ?? []).filter((f) => f.id !== medFieldId),
    });
  };

  const updateNestedField = makeNestedFieldUpdater(field, onChange);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="font-satoshi text-black-text text-[18px] font-medium">
          {field.label || 'Medication'}
        </div>
      </div>

      {!structureLocked && (
        <FormInput
          intype="text"
          inname={`group-${field.id}-label`}
          value={field.label || ''}
          inlabel="Group name"
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          className="min-h-12!"
        />
      )}

      {/* Picking which medicines the template prefills is content, not structure, so the inventory
          picker stays available even for YC-default (structure-locked) prescription templates. */}
      <Dropdown
        placeholder="Select medicine from inventory"
        value=""
        onChange={handleMedicineSelect}
        options={medicineOptions.filter((opt) => !selectedMedicines.includes(opt.value))}
        search={true}
        className="min-h-12!"
        dropdownClassName="!h-fit max-h-[300px] overflow-y-auto"
        disabled={loadingMedicines}
      />

      {(field.fields ?? []).map((nested) =>
        renderNestedField(nested, updateNestedField, removeMedicine, createField)
      )}
    </div>
  );
};

type TaskGroupBuilderProps = {
  field: FormField & { type: 'group'; fields?: FormField[] };
  onChange: (f: FormField) => void;
  createField: (t: OptionKey) => FormField;
};

const TaskGroupBuilder: React.FC<TaskGroupBuilderProps> = ({ field, onChange, createField }) => {
  const structureLocked = React.useContext(StructureLockContext);
  const addTaskBlock = () => {
    const taskNumber = (field.fields ?? []).length + 1;
    const id = `${field.id}_task_${crypto.randomUUID()}`;
    const taskField: FormField = {
      id,
      type: 'group',
      label: `Task ${taskNumber}`,
      meta: { taskBlock: true, taskBlockId: id } as any,
      fields: defaultTaskBlockFields(id, taskNumber),
    };
    onChange({ ...field, fields: [...(field.fields ?? []), taskField] });
  };

  const removeTask = (taskFieldId: string) =>
    onChange({ ...field, fields: (field.fields ?? []).filter((f) => f.id !== taskFieldId) });

  const updateNestedField = makeNestedFieldUpdater(field, onChange);

  return (
    <div className="flex flex-col gap-4">
      {!structureLocked && (
        <FormInput
          intype="text"
          inname={`group-${field.id}-label`}
          value={field.label || ''}
          inlabel="Group name"
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          className="min-h-12!"
        />
      )}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-card-border bg-neutral-0 p-3">
        <div>
          <p className="text-body-3-emphasis text-text-primary">Task blocks</p>
          <p className="text-caption-2 text-text-secondary">
            These tasks preload into the inpatient schedule when the template is applied.
          </p>
        </div>
        <Primary text="Add task" onClick={addTaskBlock} />
      </div>

      {(field.fields ?? []).map((nested) =>
        renderNestedField(nested, updateNestedField, removeTask, createField)
      )}
    </div>
  );
};

const updateFieldInForm = (
  prev: FormsProps,
  fieldId: string,
  updatedField: FormField
): FormsProps => ({
  ...prev,
  schema: (prev.schema || []).map((field) => (field.id === fieldId ? updatedField : field)),
});

const removeFieldById = (form: FormsProps, id: string): FormsProps => ({
  ...form,
  schema: (form.schema || []).filter((field) => field.id !== id),
});

const Build = ({
  formData,
  setFormData,
  onNext,
  serviceOptions,
  registerValidator,
}: BuildProps) => {
  const [buildError, setBuildError] = useState<string>('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const builderRef = React.useRef<HTMLDivElement | null>(null);
  const scrollVelocityRef = React.useRef<number>(0);
  const scrollAnimRef = React.useRef<number | null>(null);
  const createField = (key: OptionKey): FormField => {
    const id = crypto.randomUUID();
    return fieldFactory[key](id, serviceOptions);
  };

  // YC-library templates are content-only: their field structure (add / delete /
  // reorder) is locked; only field content may be edited. Mirrors the FormInfo rule.
  // YC-default templates lock their structure (content stays editable). Use the single
  // ownership flag so this matches Details.tsx's isYcDefault and cannot drift if
  // isTemplateBacked is ever cleared independently.
  const structureLocked = formData.templateSource === 'YC_LIBRARY';

  const canUseSignature =
    formData.category !== 'SOAP' &&
    formData.requiredSigner !== undefined &&
    formData.requiredSigner !== '';
  const addOptionsForContext = React.useMemo(
    () => addOptions.filter((opt) => opt.key !== 'signature' || canUseSignature),
    [canUseSignature]
  );

  const handleFieldChange = (fieldId: string, updatedField: FormField) => {
    setFormData((prev) => updateFieldInForm(prev, fieldId, updatedField));
  };

  const canDeleteField = (fieldId: string): boolean => {
    const field = (formData.schema ?? []).find((f) => f.id === fieldId);
    const signerRequired = formData.requiredSigner !== undefined && formData.requiredSigner !== '';
    if (signerRequired && field?.type === 'signature') {
      setBuildError("Cannot remove signature while 'Signed by' is selected.");
      return false;
    }
    return true;
  };

  const handleDeleteField = (fieldId: string) => {
    if (structureLocked) return;
    if (!canDeleteField(fieldId)) return;
    setBuildError('');
    setFormData((prev) => removeFieldById(prev, fieldId));
  };

  const addMedicationGroup = () => {
    setFormData((prev) => {
      const medField = createField('medication');
      const updatedSchema = addMedicationToTreatmentPlan(prev.schema ?? [], medField);
      return { ...prev, schema: updatedSchema };
    });
  };

  const addField = (key: OptionKey) => {
    if (structureLocked) return;
    if (key === 'signature') {
      if (formData.category === 'SOAP') {
        setBuildError('SOAP templates cannot include signature fields.');
        return;
      }
      if (!canUseSignature) {
        setBuildError("Select 'Signed by' in Form details before adding a signature field.");
        return;
      }
      if (hasSignatureField(formData.schema ?? [])) {
        setBuildError('Only one signature field is allowed per form.');
        return;
      }
    }

    const hasTreatmentPlan =
      formData.schema?.some((f) => f.id === 'treatment_plan' && f.type === 'group') ?? false;

    if (key === 'medication' && hasTreatmentPlan) {
      addMedicationGroup();
      return;
    }

    let newField = createField(key);
    if (key === 'service-group' && newField.type === 'group') {
      newField = ensureServiceCheckbox(newField, serviceOptions).group;
    }
    setFormData((prev) => ({
      ...prev,
      schema:
        key === 'signature' && new Set(['Prescription', 'Discharge Form']).has(prev.category)
          ? ensureSingleSignatureAtEnd([...(prev.schema ?? []), newField])
          : [...(prev.schema ?? []), newField],
    }));
    setBuildError('');
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (structureLocked) return;
    setFormData((prev) => {
      const schema = [...(prev.schema ?? [])];
      const newIndex = direction === 'up' ? index - 1 : index + 1;

      if (newIndex < 0 || newIndex >= schema.length) return prev;

      const temp = schema[index];
      schema[index] = schema[newIndex];
      schema[newIndex] = temp;

      return { ...prev, schema };
    });
  };

  const reorderField = (from: number, to: number) => {
    if (structureLocked) return;
    if (from === to) return;
    setFormData((prev) => {
      const schema = [...(prev.schema ?? [])];
      if (from < 0 || to < 0 || from >= schema.length || to >= schema.length) {
        return prev;
      }
      const targetIndex = from < to ? to - 1 : to;
      const [moved] = schema.splice(from, 1);
      schema.splice(targetIndex, 0, moved);
      return { ...prev, schema };
    });
  };

  const handleDragStart = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const getScrollableContainer = () => {
    if (builderRef.current && builderRef.current.scrollHeight > builderRef.current.clientHeight) {
      return builderRef.current;
    }
    return document.scrollingElement as HTMLElement | null;
  };

  const updateScrollVelocity = (scrollable: HTMLElement, clientY: number) => {
    const rect =
      scrollable === builderRef.current
        ? scrollable.getBoundingClientRect()
        : { top: 0, bottom: globalThis.innerHeight, height: globalThis.innerHeight };
    const softZone = Math.min(300, (rect.bottom - rect.top) / 2);
    const turboZone = softZone / 3;
    const distanceToTop = Math.max(0, clientY - rect.top);
    const distanceToBottom = Math.max(0, rect.bottom - clientY);

    if (distanceToTop < softZone && scrollable.scrollTop > 0) {
      const ratio = (softZone - distanceToTop) / softZone;
      const turbo = distanceToTop < turboZone ? 14 : 0;
      const speed = Math.min(30, Math.max(6, ratio * 20 + turbo));
      scrollVelocityRef.current = -speed;
      return;
    }

    if (distanceToBottom < softZone) {
      const ratio = (softZone - distanceToBottom) / softZone;
      const turbo = distanceToBottom < turboZone ? 14 : 0;
      const speed = Math.min(30, Math.max(6, ratio * 20 + turbo));
      scrollVelocityRef.current = speed;
      return;
    }

    scrollVelocityRef.current = 0;
  };

  const startAutoScroll = (scrollable: HTMLElement) => {
    if (scrollAnimRef.current !== null) return;
    const step = () => {
      const vel = scrollVelocityRef.current;
      if (vel === 0) {
        scrollAnimRef.current = null;
        return;
      }
      scrollable.scrollTop += vel;
      scrollAnimRef.current = requestAnimationFrame(step);
    };
    scrollAnimRef.current = requestAnimationFrame(step);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const scrollable = getScrollableContainer();
    if (!scrollable) return;
    updateScrollVelocity(scrollable, e.clientY);
    startAutoScroll(scrollable);
  };

  const handleDrop = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragIndex === null) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;
    const destination = isAfter ? index + 1 : index;
    reorderField(dragIndex, destination);
    setDragIndex(null);
    scrollVelocityRef.current = 0;
    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    scrollVelocityRef.current = 0;
    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  };

  useEffect(() => {
    if (!serviceOptions.length) return;
    setFormData((prev) => ({
      ...prev,
      schema: (prev.schema ?? []).map((field) =>
        isServiceGroup(field) ? ensureServiceCheckbox(field, serviceOptions).group : field
      ),
    }));
  }, [serviceOptions, setFormData]);

  const validate = React.useCallback(() => {
    if (!formData.schema || formData.schema.length === 0) {
      setBuildError('Add at least one field to continue.');
      return false;
    }
    setBuildError('');
    return true;
  }, [formData.schema]);

  React.useEffect(() => {
    registerValidator?.(validate);
  }, [registerValidator, validate]);

  return (
    <StructureLockContext.Provider value={structureLocked}>
      <div className="flex flex-col gap-6 w-full flex-1 justify-between" ref={builderRef}>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="font-satoshi text-black-text text-[23px] font-medium">Build form</div>
            {!structureLocked && (
              <AddFieldDropdown
                onSelect={addField}
                buttonClassName="w-fit"
                options={addOptionsForContext}
              />
            )}
          </div>

          {formData.schema?.map((field, index) => {
            const fieldId = field.id; // Store ID to avoid TypeScript narrowing issues
            const canMoveUp = index > 0;
            const canMoveDown = index < (formData.schema?.length ?? 0) - 1;

            if (field.type === 'group') {
              const isDragging = dragIndex === index;
              // Service groups seed a checkbox first; every other group kind renders
              // the field as-is. All kinds share the same draggable wrapper, so only
              // the inner builder differs.
              const ensured = isServiceGroup(field)
                ? ensureServiceCheckbox(field, serviceOptions).group
                : field;

              let groupBuilder: React.ReactNode;
              if (isMedicationGroup(field)) {
                groupBuilder = (
                  <MedicationGroupBuilder
                    field={field}
                    onChange={(updatedField) => handleFieldChange(fieldId, updatedField)}
                    createField={createField}
                  />
                );
              } else if (isTaskGroup(field)) {
                groupBuilder = (
                  <TaskGroupBuilder
                    field={field}
                    onChange={(updatedField) => handleFieldChange(fieldId, updatedField)}
                    createField={createField}
                  />
                );
              } else {
                groupBuilder = (
                  <GroupBuilder
                    field={ensured}
                    onChange={(updatedField) => handleFieldChange(fieldId, updatedField)}
                    createField={createField}
                    serviceOptions={serviceOptions}
                  />
                );
              }

              return (
                <BuilderWrapper
                  key={ensured.id}
                  field={ensured}
                  onDelete={() => handleDeleteField(fieldId)}
                  onMoveUp={() => moveField(index, 'up')}
                  onMoveDown={() => moveField(index, 'down')}
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  isDragging={isDragging}
                >
                  {groupBuilder}
                </BuilderWrapper>
              );
            }
            return (
              <FieldBuilder
                key={fieldId}
                field={field}
                onChange={(updatedField) => handleFieldChange(fieldId, updatedField)}
                onDelete={() => handleDeleteField(fieldId)}
                onMoveUp={() => moveField(index, 'up')}
                onMoveDown={() => moveField(index, 'down')}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                createField={createField}
                draggable
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={handleDrop(index)}
                onDragEnd={handleDragEnd}
                isDragging={dragIndex === index}
              />
            );
          })}
          {buildError && (
            <div className="mt-1.5 flex items-center gap-1 px-2 text-caption-2 text-text-error">
              <IoIosWarning className="text-text-error" size={14} />
              <span>{buildError}</span>
            </div>
          )}

          {/* Add Field Button at bottom */}
          {!structureLocked && (
            <div className="flex flex-col items-center gap-2 py-4 border-2 border-dashed border-grey-light rounded-2xl hover:border-grey-noti transition-colors">
              <div className="flex flex-col items-center gap-1">
                <AddFieldDropdown
                  onSelect={addField}
                  buttonClassName="w-fit"
                  options={addOptionsForContext}
                />
                <span className="text-sm font-satoshi font-medium text-grey-noti">Add Field</span>
              </div>
            </div>
          )}
        </div>
        <div className="px-3 pb-3 flex justify-center">
          <Primary href="#" text="Next" onClick={onNext} className="w-fit" />
        </div>
      </div>
    </StructureLockContext.Provider>
  );
};

export default Build;
