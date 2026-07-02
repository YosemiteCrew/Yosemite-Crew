import { Primary } from '@/app/ui/primitives/Buttons';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { LuCopy, LuPlus, LuTrash2 } from 'react-icons/lu';
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
          icon={<LuTrash2 size={16} aria-hidden="true" />}
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
  const structureLocked = React.useContext(StructureLockContext);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const [medicines, setMedicines] = useState<InventoryApiItem[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const selectedMedicines = React.useMemo(
    () =>
      (field.fields ?? [])
        .map((item) => (item.meta as { medicineId?: string } | undefined)?.medicineId)
        .filter((value): value is string => Boolean(value)),
    [field.fields]
  );

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

    const medicineCount = (field.fields ?? []).length + 1;
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
      fields: [...(field.fields ?? []), newMedicineGroup],
    });
  };

  const removeMedicine = (medFieldId: string) => {
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

      {/* Adding a medicine is content (not structure), so the picker stays available
          even on YC-default (structure-locked) templates. */}
      <LabelDropdown
        placeholder={loadingMedicines ? 'Loading medicines…' : 'Add medicine from inventory'}
        options={medicineOptions.filter((opt) => !selectedMedicines.includes(opt.value))}
        onSelect={(option) => handleMedicineSelect(option.value)}
        noOptionsMessage={loadingMedicines ? 'Loading medicines…' : 'No medicines available'}
      />

      {(field.fields ?? []).map((nested) => {
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
const TaskBlockCard: React.FC<{
  block: FormField & { type: 'group'; fields?: FormField[] };
  index: number;
  onChange: (next: FormField) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}> = ({ block, index, onChange, onDuplicate, onRemove }) => {
  const fieldByKey = (key: string) =>
    (block.fields ?? []).find((f) => (f.meta as { taskBlockKey?: string })?.taskBlockKey === key);

  const fieldOptions = (f?: FormField): { label: string; value: string }[] =>
    ((f as { options?: { label: string; value: string }[] } | undefined)?.options ?? []) as {
      label: string;
      value: string;
    }[];

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
            icon={<LuCopy size={16} aria-hidden="true" />}
            label={`Duplicate task ${index + 1}`}
            onClick={onDuplicate}
          />
          <CircleIconButton
            icon={<LuTrash2 size={16} aria-hidden="true" />}
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
  const buildTaskBlock = (): FormField => {
    const id = `${field.id}_task_${crypto.randomUUID()}`;
    return {
      id,
      type: 'group',
      label: `Task ${(field.fields ?? []).length + 1}`,
      meta: { taskBlock: true, taskBlockId: id } as any,
      fields: defaultTaskBlockFields(id),
    };
  };

  const addTaskBlock = () => {
    onChange({ ...field, fields: [...(field.fields ?? []), buildTaskBlock()] });
  };

  // Duplicate a block with fresh field ids so the new block is independently editable.
  const duplicateTaskBlock = (source: FormField & { type: 'group'; fields?: FormField[] }) => {
    const id = `${field.id}_task_${crypto.randomUUID()}`;
    const clone: FormField = {
      ...source,
      id,
      label: `Task ${(field.fields ?? []).length + 1}`,
      meta: { taskBlock: true, taskBlockId: id } as any,
      fields: (source.fields ?? []).map((f) => ({ ...f, id: `${id}_${f.id.split('_').pop()}` })),
    };
    onChange({ ...field, fields: [...(field.fields ?? []), clone] });
  };

  const removeTask = (taskFieldId: string) =>
    onChange({ ...field, fields: (field.fields ?? []).filter((f) => f.id !== taskFieldId) });

  const updateBlock = (id: string, updated: FormField) =>
    onChange({
      ...field,
      fields: (field.fields ?? []).map((f) => (f.id === id ? updated : f)),
    });

  const blocks = (field.fields ?? []).filter(
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
            <LuPlus size={14} aria-hidden="true" />
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
            <LuPlus size={14} aria-hidden="true" />
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
                  />
                );
              } else if (isTaskGroup(field)) {
                groupBuilder = (
                  <TaskGroupBuilder
                    field={field}
                    onChange={(updatedField) => handleFieldChange(fieldId, updatedField)}
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
