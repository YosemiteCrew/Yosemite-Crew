import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import {
  IoAddOutline,
  IoCopyOutline,
  IoTrashOutline,
  IoReorderTwoOutline,
  IoTextOutline,
  IoReaderOutline,
  IoCheckboxOutline,
  IoRadioButtonOnOutline,
  IoCalendarOutline,
  IoCreateOutline,
  IoRemoveOutline,
  IoListOutline,
  IoMedkitOutline,
  IoBriefcaseOutline,
  IoCheckmarkDoneOutline,
  IoLayersOutline,
  IoEllipsisHorizontal,
  IoChevronUp,
  IoChevronDown,
} from 'react-icons/io5';
import {
  FormField,
  FormFieldType,
  FormsProps,
  buildMedicationFields,
  medicationRouteOptions,
  TASK_CATEGORY_FIELD_OPTIONS,
  TASK_RECURRENCE_FIELD_OPTIONS,
  TASK_REMINDER_FIELD_OPTIONS,
} from '@/app/features/forms/types/forms';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import {
  DURATION_UNIT_OPTIONS,
  FREQUENCY_OPTIONS,
  inventoryToPrescriptionItem,
} from '@/app/features/appointments/lib/inventoryPrescription';
import React, { use, useEffect, useRef, useState } from 'react';
import type { AddFormStepHandle } from '@/app/features/forms/pages/Forms/Sections/AddForm/Details';
import {
  ensureServiceCheckbox,
  getServiceCheckbox,
  isServiceGroup,
} from '@/app/features/forms/pages/Forms/Sections/AddForm/serviceGroupHelpers';
import { IoIosAddCircleOutline, IoIosWarning } from 'react-icons/io';
import TextBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Text/TextBuilder';
import RichTextBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/RichText/RichTextBuilder';
import InputBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Input/InputBuilder';
import DropdownBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Dropdown/DropdownBuilder';
import SignatureBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Signature/SignatureBuilder';
import BuilderWrapper from '@/app/features/forms/pages/Forms/Sections/AddForm/components/BuildWrapper';
import { StructureLockContext } from '@/app/features/forms/pages/Forms/Sections/AddForm/components/structureLockContext';
import BooleanBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Boolean/BooleanBuilder';
import DateBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Date/DateBuilder';
import { useOrgStore } from '@/app/stores/orgStore';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import { InventoryApiItem } from '@/app/features/inventory/pages/Inventory/types';
import { mapApiItemToInventoryItem } from '@/app/features/inventory/pages/Inventory/utils';
import { ensureSingleSignatureAtEnd, hasSignatureField } from '@/app/lib/forms';

// `FormsProps.schema` is optional (a draft may never have had one), so every read/mutation of
// the field list normalises through here rather than repeating the fallback at each call site.
const schemaOf = (form: FormsProps): FormField[] => form.schema ?? [];

// Builds a nested-field updater for a group field. Shared by the service/medication/task
// group builders so their (otherwise identical) update handlers aren't duplicated.
const makeNestedFieldUpdater =
  (
    group: FormField & { type: 'group'; fields: FormField[] },
    onChange: (next: FormField) => void
  ) =>
  (id: string, updatedField: FormField): void => {
    onChange({
      ...group,
      fields: group.fields.map((f) => (f.id === id ? updatedField : f)),
    });
  };

type BuildProps = {
  formData: FormsProps;
  setFormData: React.Dispatch<React.SetStateAction<FormsProps>>;
  serviceOptions: { label: string; value: string; badge?: string }[];
  ref?: React.Ref<AddFormStepHandle>;
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

// `mapApiItemToInventoryItem` already folds the raw item's own `category` / `itemType` into the
// normalized shape (`basicInfo.category` is `apiItem.category ?? ''`, and both `basicInfo.itemType`
// and `classification.itemType` come from the same `normalizeItemTypeForForm(...)` call), so the
// normalized values are the only ones worth reading here.
const isMedicineInventoryItem = (item: InventoryApiItem): boolean => {
  const normalized = mapApiItemToInventoryItem(item);
  const category = normalized.basicInfo.category.trim().toLowerCase();
  /* v8 ignore next -- `normalizeItemTypeForForm` always returns a string, so `classification.itemType` is never nullish; the fallback only satisfies the optional type */
  const itemType = (normalized.classification.itemType ?? '').trim().toLowerCase();
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

// Default field set for one task block in a YC-default Task Template. Each field
// carries a `taskBlockKey` so lib/forms.ts serializes the block into the
// TASK_ASSIGNMENT template rules (and the inpatient schedule preloads from it).
// The values are authored via the dedicated TaskBlockCard (not generic builder
// rows), so labels/placeholders here are the card's field captions.
const defaultTaskBlockFields = (prefix: string): FormField[] => [
  {
    id: `${prefix}_name`,
    type: 'input',
    label: 'Task title',
    placeholder: 'Eg.: Record vitals',
    defaultValue: '',
    meta: { taskBlockKey: 'name' },
  },
  {
    id: `${prefix}_category`,
    type: 'dropdown',
    label: 'Category',
    options: TASK_CATEGORY_FIELD_OPTIONS,
    defaultValue: 'CARE',
    meta: { taskBlockKey: 'category' },
  },
  {
    id: `${prefix}_additionalNotes`,
    type: 'textarea',
    label: 'Instructions (optional)',
    placeholder: 'Add default instructions for this task',
    meta: { taskBlockKey: 'additionalNotes' },
  },
  {
    id: `${prefix}_recurrence`,
    type: 'dropdown',
    label: 'Repeat',
    options: TASK_RECURRENCE_FIELD_OPTIONS,
    defaultValue: 'EVERY_6_HOURS',
    meta: { taskBlockKey: 'recurrence.type' },
  },
  {
    id: `${prefix}_reminderOffsetMinutes`,
    type: 'dropdown',
    label: 'Reminder (optional)',
    options: TASK_REMINDER_FIELD_OPTIONS,
    defaultValue: '5',
    meta: { taskBlockKey: 'reminderOffsetMinutes' },
  },
  {
    id: `${prefix}_durationDays`,
    type: 'number',
    label: 'Duration (days)',
    placeholder: '3',
    defaultValue: '3',
    meta: { taskBlockKey: 'durationDays' },
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
        <div className="absolute top-[120%] z-10 right-0 rounded-2xl border border-grey-noti bg-neutral-0 shadow-md! flex flex-col items-center w-[160px]">
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

const isTaskGroup = (field: FormField): field is FormField & { type: 'group' } =>
  field.type === 'group' && Boolean(field.meta?.taskGroup);

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
  const structureLocked = use(StructureLockContext);
  const groupField: FormField & { type: 'group'; fields: FormField[] } = {
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
        // Spreading a nullish meta is a no-op, so this keeps any existing meta without
        // needing to branch on it.
        meta: { ...checkbox?.meta, serviceIds: values },
      };
      onChange({
        ...group,
        meta: { ...group.meta, serviceIds: values },
        fields: group.fields.map((f) => (f.id === checkbox?.id ? (nextCheckbox as FormField) : f)),
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
      fields: groupField.fields.filter((f) => f.id !== id),
    });

  const addNestedField = (key: OptionKey) => {
    const newField = createField(key);
    onChange({
      ...groupField,
      fields: [...groupField.fields, newField],
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
        />
      )}

      {groupField.fields.map((nested) => {
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

/** Adapt a plain string vocabulary (e.g. FREQUENCY_OPTIONS) into LabelDropdown options. */
const toLabelOptions = (values: string[]): { label: string; value: string }[] =>
  values.map((value) => ({ label: value, value }));

/** Read a medicine field's authored value by its `prescriptionField` meta key. */
const medicineFieldValue = (group: FormField & { fields?: FormField[] }, key: string): string => {
  const field = (group.fields ?? []).find(
    (f) => (f.meta as { prescriptionField?: string })?.prescriptionField === key
  );
  if (!field) return '';
  const value = (field as FormField & { defaultValue?: unknown }).defaultValue;
  return value === undefined || value === null ? '' : String(value);
};

/**
 * One medicine in a YC-default Prescription Template, rendered as a clean card
 * mirroring the task-template card and the workspace prescription line item:
 * a read-only inventory summary header plus editable Route / Frequency / Duration
 * / Quantity / Refills / Instructions using the reusable searchable LabelDropdown.
 * Each control writes back into the matching `prescriptionField` leaf field.
 */
const MedicineCard: React.FC<{
  group: FormField & { type: 'group'; fields?: FormField[] };
  onChange: (next: FormField) => void;
  onRemove: () => void;
}> = ({ group, onChange, onRemove }) => {
  const setKeyValue = (key: string, value: string) => {
    onChange({
      ...group,
      fields: (group.fields ?? []).map((f) =>
        (f.meta as { prescriptionField?: string })?.prescriptionField === key
          ? { ...f, defaultValue: value }
          : f
      ),
    });
  };

  const name = medicineFieldValue(group, 'medicineName') || group.label || 'Medicine';
  const brand = medicineFieldValue(group, 'brand');
  const sku = medicineFieldValue(group, 'sku');
  const strength = medicineFieldValue(group, 'strength');
  const strengthUnit = medicineFieldValue(group, 'strengthUnit');
  const dosageForm = medicineFieldValue(group, 'dosageForm');
  const drugSchedule = medicineFieldValue(group, 'drugSchedule');

  const summary = [
    brand,
    [strength, strengthUnit].filter(Boolean).join(' '),
    dosageForm,
    sku && `SKU ${sku}`,
    drugSchedule,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-card-border bg-neutral-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-body-3-emphasis text-text-primary">{name}</span>
          {summary && <span className="text-caption-2 text-text-secondary">{summary}</span>}
        </div>
        <CircleIconButton
          icon={<IoTrashOutline size={16} aria-hidden="true" />}
          label={`Remove ${name}`}
          onClick={onRemove}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <LabelDropdown
          placeholder="Route"
          options={medicationRouteOptions}
          defaultOption={medicineFieldValue(group, 'route')}
          onSelect={(option) => setKeyValue('route', option.value)}
        />
        <LabelDropdown
          placeholder="Frequency"
          options={toLabelOptions(FREQUENCY_OPTIONS)}
          defaultOption={medicineFieldValue(group, 'frequency')}
          onSelect={(option) => setKeyValue('frequency', option.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormInput
          intype="number"
          inname={`${group.id}-duration`}
          value={medicineFieldValue(group, 'durationDays')}
          inlabel="Duration"
          onChange={(e) => setKeyValue('durationDays', e.target.value)}
        />
        <LabelDropdown
          placeholder="Duration unit"
          options={toLabelOptions(DURATION_UNIT_OPTIONS)}
          defaultOption={medicineFieldValue(group, 'durationUnit') || 'days'}
          searchable={false}
          onSelect={(option) => setKeyValue('durationUnit', option.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormInput
          intype="number"
          inname={`${group.id}-qty`}
          value={medicineFieldValue(group, 'qty')}
          inlabel="Quantity"
          onChange={(e) => setKeyValue('qty', e.target.value)}
        />
        <FormInput
          intype="number"
          inname={`${group.id}-refill`}
          value={medicineFieldValue(group, 'refill')}
          inlabel="Refills"
          onChange={(e) => setKeyValue('refill', e.target.value)}
        />
      </div>

      <FormDesc
        intype="text"
        inname={`${group.id}-instructions`}
        value={medicineFieldValue(group, 'instructions')}
        inlabel="Instructions (optional)"
        onChange={(e) => setKeyValue('instructions', e.target.value)}
        className="min-h-24!"
      />
    </div>
  );
};

type MedicationGroupBuilderProps = {
  field: FormField & { type: 'group'; fields?: FormField[] };
  onChange: (f: FormField) => void;
};

const MedicationGroupBuilder: React.FC<MedicationGroupBuilderProps> = ({ field, onChange }) => {
  const structureLocked = use(StructureLockContext);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const [medicines, setMedicines] = useState<InventoryApiItem[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  // A group saved before it held any medicine has no `fields` array at all; normalise once so
  // the handlers and the render below can treat the medicine list as an array.
  const medicineGroups = React.useMemo(() => field.fields ?? [], [field.fields]);
  const selectedMedicines = React.useMemo(
    () =>
      medicineGroups
        .map((item) => (item.meta as { medicineId?: string } | undefined)?.medicineId)
        .filter((value): value is string => Boolean(value)),
    [medicineGroups]
  );
  const selectedMedicineSet = React.useMemo(() => new Set(selectedMedicines), [selectedMedicines]);

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
    if (!medicineId || selectedMedicineSet.has(medicineId)) return;

    const medicine = medicines.find((m) => m._id === medicineId);
    /* v8 ignore next -- defensive: the picker's options are derived from `medicines`, so a selected id always resolves back to an item */
    if (!medicine) return;
    const normalizedMedicine = mapApiItemToInventoryItem(medicine);
    const inventoryItemId = medicine._id;

    const medicineCount = medicineGroups.length + 1;
    const fieldPrefix = `${field.id}_med_${medicineCount}`;

    // Read inventory-sourced values through the same mapper used by the Treatment step so the
    // template author sees/persists the same prescription row shape the workspace consumes.
    const prescriptionDefaults = inventoryToPrescriptionItem(normalizedMedicine);
    const displayName = prescriptionDefaults.medicineName || medicine.name || 'Medicine';
    const readonlyField = (
      suffix: string,
      prescriptionField: string,
      label: string,
      value?: string | number | boolean
    ): FormField => ({
      id: `${fieldPrefix}_${suffix}`,
      type: typeof value === 'number' ? 'number' : 'input',
      label,
      placeholder: value === undefined ? '' : String(value),
      defaultValue: typeof value === 'boolean' ? String(value) : value,
      meta: { readonly: true, inventoryItemId, prescriptionField },
    });
    const templateField = (
      suffix: string,
      prescriptionField: string,
      label: string,
      type: 'input' | 'number' | 'textarea' = 'input',
      defaultValue?: string
    ): FormField => ({
      id: `${fieldPrefix}_${suffix}`,
      type,
      label,
      placeholder: '',
      defaultValue,
      meta: { inventoryItemId, prescriptionField },
    });
    const medicationFields: FormField[] = [
      readonlyField('name', 'medicineName', 'Name', displayName),
      readonlyField('brand', 'brand', 'Brand', prescriptionDefaults.brand),
      readonlyField('genericName', 'genericName', 'Generic name', prescriptionDefaults.genericName),
      readonlyField('sku', 'sku', 'SKU', prescriptionDefaults.sku),
      readonlyField('strength', 'strength', 'Strength', prescriptionDefaults.strength),
      readonlyField(
        'strengthUnit',
        'strengthUnit',
        'Strength unit',
        prescriptionDefaults.strengthUnit
      ),
      templateField('form', 'dosageForm', 'Form', 'input', prescriptionDefaults.dosageForm),
      readonlyField('dosage', 'dosage', 'Dose label', prescriptionDefaults.dosage),
      templateField('route', 'route', 'Route', 'input', prescriptionDefaults.route),
      templateField('frequency', 'frequency', 'Frequency'),
      templateField('duration', 'durationDays', 'Duration'),
      templateField('durationUnit', 'durationUnit', 'Duration unit', 'input', 'days'),
      templateField('qty', 'qty', 'Quantity', 'number'),
      templateField('refill', 'refill', 'Refills', 'number'),
      templateField('remark', 'instructions', 'Instructions', 'textarea'),
      readonlyField('fulfillment', 'fulfillment', 'Fulfillment', prescriptionDefaults.fulfillment),
      readonlyField(
        'inventoryBatchId',
        'inventoryBatchId',
        'Batch',
        prescriptionDefaults.inventoryBatchId
      ),
      readonlyField('priceCents', 'priceCents', 'Price (cents)', prescriptionDefaults.priceCents),
      readonlyField(
        'controlledSubstance',
        'controlledSubstance',
        'Controlled substance',
        prescriptionDefaults.controlledSubstance
      ),
      readonlyField(
        'prescriptionRequired',
        'prescriptionRequired',
        'Prescription required',
        prescriptionDefaults.prescriptionRequired
      ),
      readonlyField(
        'drugSchedule',
        'drugSchedule',
        'Drug schedule',
        prescriptionDefaults.drugSchedule
      ),
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

    onChange({
      ...field,
      fields: [...medicineGroups, newMedicineGroup],
    });
  };

  const removeMedicine = (medFieldId: string) => {
    onChange({
      ...field,
      fields: medicineGroups.filter((f) => f.id !== medFieldId),
    });
  };

  const updateNestedField = makeNestedFieldUpdater({ ...field, fields: medicineGroups }, onChange);

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
        />
      )}

      {/* Adding a medicine is content (not structure), so the picker stays available
          even on YC-default (structure-locked) templates. */}
      <LabelDropdown
        placeholder={loadingMedicines ? 'Loading medicines…' : 'Add medicine from inventory'}
        options={medicineOptions.filter((opt) => !selectedMedicineSet.has(opt.value))}
        onSelect={(option) => handleMedicineSelect(option.value)}
        noOptionsMessage={loadingMedicines ? 'Loading medicines…' : 'No medicines available'}
      />

      {medicineGroups.map((nested) => {
        const medicineGroup = nested as FormField & { type: 'group'; fields?: FormField[] };
        if (medicineGroup.type !== 'group') return null;
        return (
          <MedicineCard
            key={medicineGroup.id}
            group={medicineGroup}
            onChange={(updated) => updateNestedField(medicineGroup.id, updated)}
            onRemove={() => removeMedicine(medicineGroup.id)}
          />
        );
      })}
    </div>
  );
};

type TaskGroupBuilderProps = {
  field: FormField & { type: 'group'; fields?: FormField[] };
  onChange: (f: FormField) => void;
};

/** Read the authored value of a task-block leaf field (defaultValue, else placeholder). */
const taskBlockFieldValue = (field?: FormField): string => {
  if (!field) return '';
  const value = (field as FormField & { defaultValue?: unknown }).defaultValue;
  // Only the authored value — never the placeholder. Falling back to the
  // placeholder made it render as the input's value (so it reappeared on
  // backspace) instead of acting as a real placeholder hint.
  return value === undefined || value === null ? '' : String(value);
};

/**
 * One task block in the "Building a template" task builder, rendered as the
 * mockup card: Task title, Category, Instructions, Repeat, Reminder, Duration —
 * with duplicate/delete header actions. Each control writes back into the
 * matching `taskBlockKey` leaf field's `defaultValue`, which lib/forms.ts reads
 * when serializing the block into the TASK_ASSIGNMENT template rules.
 */
const fieldOptions = (f?: FormField): { label: string; value: string }[] =>
  ((f as { options?: { label: string; value: string }[] } | undefined)?.options ?? []) as {
    label: string;
    value: string;
  }[];

const TaskBlockCard: React.FC<{
  block: FormField & { type: 'group'; fields?: FormField[] };
  index: number;
  onChange: (next: FormField) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}> = ({ block, index, onChange, onDuplicate, onRemove }) => {
  const fieldByKey = (key: string) =>
    (block.fields ?? []).find((f) => (f.meta as { taskBlockKey?: string })?.taskBlockKey === key);

  const setKeyValue = (key: string, value: string) => {
    onChange({
      ...block,
      fields: (block.fields ?? []).map((f) =>
        (f.meta as { taskBlockKey?: string })?.taskBlockKey === key
          ? { ...f, defaultValue: value }
          : f
      ),
    });
  };

  const titleField = fieldByKey('name');
  const categoryField = fieldByKey('category');
  const instructionsField = fieldByKey('additionalNotes');
  const repeatField = fieldByKey('recurrence.type');
  const reminderField = fieldByKey('reminderOffsetMinutes');
  const durationField = fieldByKey('durationDays');

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-card-border bg-neutral-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-3-emphasis text-text-primary">Task {index + 1}</p>
        <div className="flex items-center gap-2">
          <CircleIconButton
            icon={<IoCopyOutline size={16} aria-hidden="true" />}
            label={`Duplicate task ${index + 1}`}
            onClick={onDuplicate}
          />
          <CircleIconButton
            icon={<IoTrashOutline size={16} aria-hidden="true" />}
            label={`Remove task ${index + 1}`}
            onClick={onRemove}
          />
        </div>
      </div>

      <FormInput
        intype="text"
        inname={`${block.id}-title`}
        value={taskBlockFieldValue(titleField)}
        inlabel={titleField?.label || 'Task title'}
        onChange={(e) => setKeyValue('name', e.target.value)}
      />

      <LabelDropdown
        placeholder={categoryField?.label || 'Category'}
        defaultOption={taskBlockFieldValue(categoryField)}
        options={
          fieldOptions(categoryField).length
            ? fieldOptions(categoryField)
            : TASK_CATEGORY_FIELD_OPTIONS
        }
        searchable={false}
        onSelect={(option) => setKeyValue('category', option.value)}
      />

      <FormDesc
        intype="text"
        inname={`${block.id}-instructions`}
        value={taskBlockFieldValue(instructionsField)}
        inlabel={instructionsField?.label || 'Instructions (optional)'}
        onChange={(e) => setKeyValue('additionalNotes', e.target.value)}
        className="min-h-24!"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <LabelDropdown
          placeholder={repeatField?.label || 'Repeat'}
          defaultOption={taskBlockFieldValue(repeatField)}
          options={
            fieldOptions(repeatField).length
              ? fieldOptions(repeatField)
              : TASK_RECURRENCE_FIELD_OPTIONS
          }
          searchable={false}
          onSelect={(option) => setKeyValue('recurrence.type', option.value)}
        />
        <LabelDropdown
          placeholder={reminderField?.label || 'Reminder (optional)'}
          defaultOption={taskBlockFieldValue(reminderField)}
          options={
            fieldOptions(reminderField).length
              ? fieldOptions(reminderField)
              : TASK_REMINDER_FIELD_OPTIONS
          }
          searchable={false}
          onSelect={(option) => setKeyValue('reminderOffsetMinutes', option.value)}
        />
      </div>

      <FormInput
        intype="number"
        inname={`${block.id}-duration`}
        value={taskBlockFieldValue(durationField)}
        inlabel={durationField?.label || 'Duration (days)'}
        onChange={(e) => setKeyValue('durationDays', e.target.value)}
      />
    </div>
  );
};

const TaskGroupBuilder: React.FC<TaskGroupBuilderProps> = ({ field, onChange }) => {
  // A task group saved before it held any block has no `fields` array at all; normalise once so
  // the handlers below can treat the block list as an array.
  const taskFields = field.fields ?? [];

  const buildTaskBlock = (): FormField => {
    const id = `${field.id}_task_${crypto.randomUUID()}`;
    return {
      id,
      type: 'group',
      label: `Task ${taskFields.length + 1}`,
      meta: { taskBlock: true, taskBlockId: id } as any,
      fields: defaultTaskBlockFields(id),
    };
  };

  const addTaskBlock = () => {
    onChange({ ...field, fields: [...taskFields, buildTaskBlock()] });
  };

  // Duplicate a block with fresh field ids so the new block is independently editable.
  const duplicateTaskBlock = (source: FormField & { type: 'group'; fields?: FormField[] }) => {
    const id = `${field.id}_task_${crypto.randomUUID()}`;
    const clone: FormField = {
      ...source,
      id,
      label: `Task ${taskFields.length + 1}`,
      meta: { taskBlock: true, taskBlockId: id } as any,
      fields: (source.fields ?? []).map((f) => ({ ...f, id: `${id}_${f.id.split('_').pop()}` })),
    };
    onChange({ ...field, fields: [...taskFields, clone] });
  };

  const removeTask = (taskFieldId: string) =>
    onChange({ ...field, fields: taskFields.filter((f) => f.id !== taskFieldId) });

  const updateBlock = (id: string, updated: FormField) =>
    onChange({
      ...field,
      fields: taskFields.map((f) => (f.id === id ? updated : f)),
    });

  const blocks = taskFields.filter(
    (f): f is FormField & { type: 'group'; fields?: FormField[] } => f.type === 'group'
  );

  return (
    <div className="flex flex-col gap-4">
      {blocks.length === 0 ? (
        <button
          type="button"
          onClick={addTaskBlock}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-card-border bg-neutral-0 p-6 text-body-3-emphasis text-text-primary"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-neutral-900 text-neutral-0">
            <IoAddOutline size={14} aria-hidden="true" />
          </span>
          <span>Add task block</span>
        </button>
      ) : (
        blocks.map((block, index) => (
          <TaskBlockCard
            key={block.id}
            block={block}
            index={index}
            onChange={(updated) => updateBlock(block.id, updated)}
            onDuplicate={() => duplicateTaskBlock(block)}
            onRemove={() => removeTask(block.id)}
          />
        ))
      )}

      {blocks.length > 0 && (
        <button
          type="button"
          onClick={addTaskBlock}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-card-border bg-neutral-0 p-4 text-body-3-emphasis text-text-primary"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-neutral-900 text-neutral-0">
            <IoAddOutline size={14} aria-hidden="true" />
          </span>
          <span>Add another task</span>
        </button>
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
  schema: schemaOf(prev).map((field) => (field.id === fieldId ? updatedField : field)),
});

const removeFieldById = (form: FormsProps, id: string): FormsProps => ({
  ...form,
  schema: schemaOf(form).filter((field) => field.id !== id),
});

// ---- Single-screen builder pieces -------------------------------------------------

/** Palette icon per add-option key (design's field tiles). */
const paletteIconFor = (key: OptionKey): React.ReactNode => {
  const map: Partial<Record<OptionKey, React.ReactNode>> = {
    input: <IoTextOutline size={15} aria-hidden="true" />,
    textarea: <IoReaderOutline size={15} aria-hidden="true" />,
    richtext: <IoReaderOutline size={15} aria-hidden="true" />,
    number: <IoTextOutline size={15} aria-hidden="true" />,
    dropdown: <IoListOutline size={15} aria-hidden="true" />,
    radio: <IoRadioButtonOnOutline size={15} aria-hidden="true" />,
    checkbox: <IoCheckboxOutline size={15} aria-hidden="true" />,
    boolean: <IoCheckboxOutline size={15} aria-hidden="true" />,
    date: <IoCalendarOutline size={15} aria-hidden="true" />,
    signature: <IoCreateOutline size={15} aria-hidden="true" />,
    group: <IoRemoveOutline size={15} aria-hidden="true" />,
    medication: <IoMedkitOutline size={15} aria-hidden="true" />,
    'service-group': <IoBriefcaseOutline size={15} aria-hidden="true" />,
    'task-group': <IoCheckmarkDoneOutline size={15} aria-hidden="true" />,
  };
  return map[key] ?? <IoLayersOutline size={15} aria-hidden="true" />;
};

/** Human display name for a field, used in the canvas row summary. */
const fieldTypeName = (field: FormField): string => {
  if (field.type === 'group') {
    if (field.meta?.medicationGroup) return 'Medications';
    if (field.meta?.serviceGroup) return 'Services / Packages';
    if (field.meta?.taskGroup) return 'Tasks';
    return 'Section';
  }
  const names: Record<string, string> = {
    input: 'Short text',
    number: 'Number',
    textarea: 'Paragraph',
    richtext: 'Rich text',
    dropdown: 'Select list',
    radio: 'Single choice',
    checkbox: 'Checkbox',
    boolean: 'Yes / No',
    date: 'Date',
    signature: 'Signature',
  };
  return names[field.type] ?? field.type;
};

/** "Checkbox · required"-style summary line for a canvas row. */
const fieldRowSummary = (field: FormField, selected: boolean): string => {
  const parts = [fieldTypeName(field)];
  if (field.required) parts.push('required');
  if (field.type === 'signature') parts.push('signed in the pet-parent app');
  if (selected) parts.push('selected');
  return parts.join(' · ');
};

/** Recursively clone a field with fresh ids so duplicates edit independently. */
const cloneFieldWithNewIds = (field: FormField): FormField => {
  const nested = (field as FormField & { fields?: FormField[] }).fields;
  return {
    ...field,
    id: crypto.randomUUID(),
    ...(nested ? { fields: nested.map(cloneFieldWithNewIds) } : {}),
  } as FormField;
};

/** Pill switch used in the Field settings panel (Required / Show in summary PDF). */
const SettingToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: () => void;
}> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-[13px] font-semibold text-[var(--ink-body)]">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-10 rounded-full transition-colors ${
        checked ? 'bg-[var(--blue)]' : 'bg-[var(--divider)]'
      }`}
    >
      <span
        className={`absolute top-[3px] size-[18px] rounded-full bg-white transition-all ${
          checked ? 'right-[3px]' : 'left-[3px]'
        }`}
      />
    </button>
  </div>
);

/** Left-palette tile that adds a field of the given type to the canvas. */
const PaletteTile: React.FC<{ option: OptionProp; onAdd: (key: OptionKey) => void }> = ({
  option,
  onAdd,
}) => (
  <button
    type="button"
    onClick={() => onAdd(option.key)}
    className="flex items-center gap-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--screen)] px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--ink-body)] transition-colors hover:border-[var(--blue)]"
  >
    <span className={option.key === 'signature' ? 'text-[var(--pink)]' : 'text-[var(--blue-text)]'}>
      {paletteIconFor(option.key)}
    </span>
    {option.name}
  </button>
);

/** Compact, selectable canvas row (drag handle + label + type/required summary + actions). */
const CanvasRow: React.FC<{
  field: FormField;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
}> = ({
  field,
  selected,
  locked,
  onSelect,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
}) => {
  const isSignature = field.type === 'signature';
  const title = field.label || fieldTypeName(field);
  const borderClass = (() => {
    if (selected) return 'border-[1.5px] border-[var(--blue)] shadow-[0_0_0_3px_var(--glow-b10)]';
    if (isSignature) return 'border border-dashed border-[var(--pink)]';
    return 'border border-[var(--hairline)]';
  })();
  return (
    <div /* NOSONAR: draggable selection row that wraps action <button>s; a native <button> would nest interactive buttons (forbidden), so role="button" + tabIndex + onKeyDown provide equivalent keyboard access */
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${fieldTypeName(field)} field`}
      data-testid={`canvas-row-${field.id}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex cursor-pointer items-center gap-2.5 rounded-[13px] bg-[var(--screen)] px-4 py-3 transition-shadow ${borderClass} ${
        isDragging ? 'opacity-60' : ''
      }`}
    >
      <span data-drag-handle className={draggable ? 'cursor-grab' : ''}>
        {isSignature ? (
          <IoCreateOutline size={15} className="text-[var(--pink)]" aria-hidden="true" />
        ) : (
          <IoReorderTwoOutline size={15} className="text-[var(--ink-faint2)]" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-[var(--ink)]">{title}</span>
        <span className="block text-[11px] text-[var(--ink-faint)]">
          {fieldRowSummary(field, selected)}
        </span>
      </span>
      {selected && !locked ? (
        <span className="flex items-center gap-1.5">
          {onMoveUp && (
            <button
              type="button"
              title="Move up"
              aria-label="Move up"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
            >
              <IoChevronUp size={14} className="text-[var(--ink-faint)]" aria-hidden="true" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              title="Move down"
              aria-label="Move down"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
            >
              <IoChevronDown size={14} className="text-[var(--ink-faint)]" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            aria-label={`Duplicate ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <IoCopyOutline size={14} className="text-[var(--ink-faint)]" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`delete-${field.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <IoTrashOutline size={14} className="text-[var(--ink-faint)]" aria-hidden="true" />
          </button>
        </span>
      ) : (
        <IoEllipsisHorizontal size={15} className="text-[var(--ink-faint)]" aria-hidden="true" />
      )}
    </div>
  );
};

// Drag-to-reorder with edge auto-scroll for the builder field list. Owns the
// drag index plus the scroll velocity/animation refs so Build stays focused on
// schema state; `onReorder` receives the (from, to) indices on drop.
const useBuilderDragAutoScroll = (
  builderRef: React.RefObject<HTMLDivElement | null>,
  onReorder: (from: number, to: number) => void
) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const scrollVelocityRef = React.useRef<number>(0);
  const scrollAnimRef = React.useRef<number | null>(null);

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

  const stopAutoScroll = () => {
    scrollVelocityRef.current = 0;
    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  };

  const handleDrop = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragIndex === null) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;
    const destination = isAfter ? index + 1 : index;
    onReorder(dragIndex, destination);
    setDragIndex(null);
    stopAutoScroll();
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    stopAutoScroll();
  };

  return { dragIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
};

// ---- Build render columns ---------------------------------------------------------
// Extracted from Build's render so each of the three builder panes (palette / canvas /
// settings) is its own cohesive component with identical DOM; Build stays focused on
// schema state and passes the handlers each pane needs.

type BuilderPaletteProps = {
  structureLocked: boolean;
  options: OptionProp[];
  onAdd: (key: OptionKey) => void;
};

const BuilderPalette: React.FC<BuilderPaletteProps> = ({ structureLocked, options, onAdd }) => (
  <div className="flex w-[250px] flex-none flex-col gap-2 overflow-y-auto border-r border-[var(--hairline)] bg-[var(--screen-2)] p-4 scrollbar-hidden">
    <span className="px-1 pb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
      Add a field
    </span>
    {structureLocked ? (
      <p className="rounded-xl bg-[var(--inset)] p-3 text-[11.5px] leading-relaxed text-[var(--ink-muted)]">
        This template has a locked structure. Field content stays editable, but fields cannot be
        added, removed, or reordered.
      </p>
    ) : (
      <>
        {options.map((option) => (
          <PaletteTile key={option.key} option={option} onAdd={onAdd} />
        ))}
        <div className="mt-auto rounded-xl bg-[var(--inset)] p-3 text-[11.5px] leading-relaxed text-[var(--ink-muted)]">
          <span className="font-bold text-[var(--blue-text)]">Tip</span> · click a field to add it
          to the canvas. Signature fields make the template signable in the parent app.
        </div>
      </>
    )}
  </div>
);

type BuilderCanvasProps = {
  schema: FormField[];
  effectiveSelectedId: string | null;
  structureLocked: boolean;
  buildError: string;
  dragIndex: number | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDuplicate: (index: number) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onDragStart: (index: number) => (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (index: number) => (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
};

const BuilderCanvas: React.FC<BuilderCanvasProps> = ({
  schema,
  effectiveSelectedId,
  structureLocked,
  buildError,
  dragIndex,
  onSelect,
  onDelete,
  onDuplicate,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => (
  <div className="flex min-w-0 flex-[1.3] flex-col gap-2.5 overflow-y-auto bg-[var(--inset)] p-5">
    {schema.length === 0 && (
      <p className="text-[12.5px] text-[var(--ink-faint)]">
        No fields yet. Add a field from the palette to start building.
      </p>
    )}
    {schema.map((field, index) => (
      <CanvasRow
        key={field.id}
        field={field}
        selected={field.id === effectiveSelectedId}
        locked={structureLocked}
        onSelect={() => onSelect(field.id)}
        onDelete={() => onDelete(field.id)}
        onDuplicate={() => onDuplicate(index)}
        onMoveUp={() => onMove(index, 'up')}
        onMoveDown={() => onMove(index, 'down')}
        draggable={!structureLocked}
        onDragStart={onDragStart(index)}
        onDragOver={onDragOver}
        onDrop={onDrop(index)}
        onDragEnd={onDragEnd}
        isDragging={dragIndex === index}
      />
    ))}
    {buildError && (
      <div className="mt-1 flex items-center gap-1 px-1 text-caption-2 text-text-error">
        <IoIosWarning className="text-text-error" size={14} />
        <span>{buildError}</span>
      </div>
    )}
    {!structureLocked && (
      <span className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--divider)] p-3 text-[12.5px] font-semibold text-[var(--ink-faint)]">
        <IoAddOutline size={14} aria-hidden="true" />
        Drop a field here
      </span>
    )}
  </div>
);

type BuilderSettingsPanelProps = {
  selectedField: FormField | null;
  renderSelectedBuilder: (field: FormField) => React.ReactNode;
  onToggleRequired: (field: FormField) => void;
  onToggleSummary: (field: FormField) => void;
  linkedServices: { label: string; value: string; badge?: string }[];
  showServicePicker: boolean;
  onToggleServicePicker: () => void;
  services: string[];
  serviceOptions: { label: string; value: string; badge?: string }[];
  onServicesChange: (values: string[]) => void;
};

const BuilderSettingsPanel: React.FC<BuilderSettingsPanelProps> = ({
  selectedField,
  renderSelectedBuilder,
  onToggleRequired,
  onToggleSummary,
  linkedServices,
  showServicePicker,
  onToggleServicePicker,
  services,
  serviceOptions,
  onServicesChange,
}) => (
  <div className="flex w-[320px] max-w-[320px] flex-none flex-col gap-3.5 overflow-y-auto border-l border-[var(--hairline)] p-5 scrollbar-hidden">
    <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
      Field settings
    </span>
    {selectedField ? (
      <>
        {renderSelectedBuilder(selectedField)}
        {selectedField.type !== 'group' && (
          <>
            <SettingToggle
              label="Required"
              checked={Boolean(selectedField.required)}
              onChange={() => onToggleRequired(selectedField)}
            />
            <SettingToggle
              label="Show in summary PDF"
              checked={selectedField.meta?.showInSummaryPdf !== false}
              onChange={() => onToggleSummary(selectedField)}
            />
          </>
        )}
        <span className="h-px bg-[var(--hairline)]" />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
          Linked services
        </span>
        <div className="flex flex-col gap-2">
          {linkedServices.length === 0 && (
            <span className="text-[12px] text-[var(--ink-faint)]">No linked services yet.</span>
          )}
          {linkedServices.map((service) => (
            <span
              key={service.value}
              className="flex items-center justify-between rounded-[11px] border border-[var(--hairline)] px-3 py-2 text-[12.5px] font-semibold text-[var(--ink-body)]"
            >
              {service.label}
              <span className="rounded-full border border-[var(--status-in-progress-border)] bg-[var(--status-in-progress-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-in-progress-text)]">
                {((service as { badge?: string }).badge ?? 'SERVICE').toUpperCase()}
              </span>
            </span>
          ))}
          {showServicePicker && (
            <MultiSelectDropdown
              placeholder="Link services / packages"
              value={services}
              onChange={onServicesChange}
              options={serviceOptions}
            />
          )}
          <button
            type="button"
            onClick={onToggleServicePicker}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--blue-text)]"
          >
            <IoAddOutline size={13} aria-hidden="true" />
            Link another service
          </button>
        </div>
      </>
    ) : (
      <p className="text-[12.5px] text-[var(--ink-faint)]">
        Select a field in the canvas to edit its settings, or add one from the palette.
      </p>
    )}
  </div>
);

const Build = ({ formData, setFormData, serviceOptions, ref }: BuildProps) => {
  const [buildError, setBuildError] = useState<string>('');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const builderRef = React.useRef<HTMLDivElement | null>(null);
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
    const field = schemaOf(formData).find((f) => f.id === fieldId);
    const signerRequired = formData.requiredSigner !== undefined && formData.requiredSigner !== '';
    if (signerRequired && field?.type === 'signature') {
      setBuildError("Cannot remove signature while 'Signed by' is selected.");
      return false;
    }
    return true;
  };

  const handleDeleteField = (fieldId: string) => {
    /* v8 ignore next -- defensive: CanvasRow only renders the delete control on an unlocked row, so this cannot be reached from the UI */
    if (structureLocked) return;
    if (!canDeleteField(fieldId)) return;
    setBuildError('');
    setFormData((prev) => removeFieldById(prev, fieldId));
  };

  const addMedicationGroup = () => {
    setFormData((prev) => {
      const medField = createField('medication');
      const updatedSchema = addMedicationToTreatmentPlan(schemaOf(prev), medField);
      return { ...prev, schema: updatedSchema };
    });
  };

  const addField = (key: OptionKey) => {
    /* v8 ignore next -- defensive: BuilderPalette renders no tiles at all while locked, so this cannot be reached from the UI */
    if (structureLocked) return;
    if (key === 'signature') {
      /* v8 ignore next 8 -- unreachable defensive guards: BuilderPalette renders addOptionsForContext, which filters the signature tile out whenever category is SOAP or canUseSignature is false, so addField('signature') can only run when both guards are already satisfied */
      if (formData.category === 'SOAP') {
        setBuildError('SOAP templates cannot include signature fields.');
        return;
      }
      if (!canUseSignature) {
        setBuildError("Select 'Signed by' in Form details before adding a signature field.");
        return;
      }
      if (hasSignatureField(schemaOf(formData))) {
        setBuildError('Only one signature field is allowed per form.');
        return;
      }
    }

    const hasTreatmentPlan = schemaOf(formData).some(
      (f) => f.id === 'treatment_plan' && f.type === 'group'
    );

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
          ? ensureSingleSignatureAtEnd([...schemaOf(prev), newField])
          : [...schemaOf(prev), newField],
    }));
    setSelectedFieldId(newField.id);
    setBuildError('');
  };

  // Duplicate a top-level field (with fresh ids) directly below the original.
  const duplicateField = (index: number) => {
    /* v8 ignore next -- defensive: CanvasRow only renders the duplicate control on an unlocked row, so this cannot be reached from the UI */
    if (structureLocked) return;
    setFormData((prev) => {
      const schema = [...schemaOf(prev)];
      if (index < 0 || index >= schema.length) return prev;
      const clone = cloneFieldWithNewIds(schema[index]);
      schema.splice(index + 1, 0, clone);
      setSelectedFieldId(clone.id);
      return { ...prev, schema };
    });
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    /* v8 ignore next -- defensive: CanvasRow only renders the move controls on an unlocked row, so this cannot be reached from the UI */
    if (structureLocked) return;
    setFormData((prev) => {
      const schema = [...schemaOf(prev)];
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
      const schema = [...schemaOf(prev)];
      if (from < 0 || to < 0 || from >= schema.length || to >= schema.length) {
        return prev;
      }
      const targetIndex = from < to ? to - 1 : to;
      const [moved] = schema.splice(from, 1);
      schema.splice(targetIndex, 0, moved);
      return { ...prev, schema };
    });
  };

  const { dragIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd } =
    useBuilderDragAutoScroll(builderRef, reorderField);

  const validate = React.useCallback(() => {
    if (!formData.schema || formData.schema.length === 0) {
      setBuildError('Add at least one field to continue.');
      return false;
    }
    setBuildError('');
    return true;
  }, [formData.schema]);

  React.useImperativeHandle(ref, () => ({ validate }), [validate]);

  const schema = schemaOf(formData);
  // Derive the effective selection while rendering: default to the first field,
  // and re-point when the selected field was removed from the schema. Computing
  // this here (instead of syncing it through a useEffect) avoids a stale frame.
  const effectiveSelectedId = React.useMemo(() => {
    const ids = (formData.schema ?? []).map((f) => f.id);
    if (ids.length === 0) return null;
    if (selectedFieldId && ids.includes(selectedFieldId)) return selectedFieldId;
    return ids[0];
  }, [formData.schema, selectedFieldId]);
  const selectedField = schema.find((f) => f.id === effectiveSelectedId) ?? null;

  const toggleRequired = (field: FormField) =>
    handleFieldChange(field.id, { ...field, required: !field.required });

  const toggleSummary = (field: FormField) =>
    handleFieldChange(field.id, {
      ...field,
      meta: { ...field.meta, showInSummaryPdf: field.meta?.showInSummaryPdf === false },
    });

  const linkedServices = (formData.services ?? []).map(
    (value) => serviceOptions.find((o) => o.value === value) ?? { label: value, value }
  );

  // Render the existing builder for the selected field in the right settings panel.
  // Every field type (simple leaves + medication/task/service/generic groups) reuses
  // its original builder component, so all per-field configuration is preserved.
  const renderSelectedBuilder = (field: FormField): React.ReactNode => {
    const fieldId = field.id; // Capture before group type-guards narrow `field` to never.
    if (field.type === 'group') {
      const ensured = isServiceGroup(field)
        ? ensureServiceCheckbox(field, serviceOptions).group
        : field;
      if (isMedicationGroup(field)) {
        return (
          <MedicationGroupBuilder
            field={field}
            onChange={(updated) => handleFieldChange(fieldId, updated)}
          />
        );
      }
      if (isTaskGroup(field)) {
        return (
          <TaskGroupBuilder
            field={field}
            onChange={(updated) => handleFieldChange(fieldId, updated)}
          />
        );
      }
      return (
        <GroupBuilder
          field={ensured}
          onChange={(updated) => handleFieldChange(fieldId, updated)}
          createField={createField}
          serviceOptions={serviceOptions}
        />
      );
    }
    const Component = builderComponentMap[field.type];
    return (
      <Component
        field={field}
        onChange={(updated) => handleFieldChange(field.id, updated)}
        createField={createField}
      />
    );
  };

  return (
    <StructureLockContext.Provider value={structureLocked}>
      <div ref={builderRef} className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
        {/* LEFT · field palette */}
        <BuilderPalette
          structureLocked={structureLocked}
          options={addOptionsForContext}
          onAdd={addField}
        />

        {/* CENTER · canvas */}
        <BuilderCanvas
          schema={schema}
          effectiveSelectedId={effectiveSelectedId}
          structureLocked={structureLocked}
          buildError={buildError}
          dragIndex={dragIndex}
          onSelect={setSelectedFieldId}
          onDelete={handleDeleteField}
          onDuplicate={duplicateField}
          onMove={moveField}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />

        {/* RIGHT · field settings */}
        <BuilderSettingsPanel
          selectedField={selectedField}
          renderSelectedBuilder={renderSelectedBuilder}
          onToggleRequired={toggleRequired}
          onToggleSummary={toggleSummary}
          linkedServices={linkedServices}
          showServicePicker={showServicePicker}
          onToggleServicePicker={() => setShowServicePicker((v) => !v)}
          services={formData.services ?? []}
          serviceOptions={serviceOptions}
          onServicesChange={(values) => setFormData((prev) => ({ ...prev, services: values }))}
        />
      </div>
    </StructureLockContext.Provider>
  );
};

export default Build;
