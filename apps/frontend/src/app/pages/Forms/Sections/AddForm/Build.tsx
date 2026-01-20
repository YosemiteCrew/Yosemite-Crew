import { Primary } from "@/app/components/Buttons";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { FormField, FormFieldType, FormsProps, buildMedicationFields } from "@/app/types/forms";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { IoIosAddCircleOutline, IoIosWarning } from "react-icons/io";
import TextBuilder from "./components/Text/TextBuilder";
import InputBuilder from "./components/Input/InputBuilder";
import DropdownBuilder from "./components/Dropdown/DropdownBuilder";
import SignatureBuilder from "./components/Signature/SignatureBuilder";
import BuilderWrapper from "./components/BuildWrapper";
import BooleanBuilder from "./components/Boolean/BooleanBuilder";
import DateBuilder from "./components/Date/DateBuilder";
import { useOrgStore } from "@/app/stores/orgStore";
import { fetchInventoryItems } from "@/app/services/inventoryService";
import { InventoryApiItem } from "@/app/pages/Inventory/types";

type BuildProps = {
  formData: FormsProps;
  setFormData: React.Dispatch<React.SetStateAction<FormsProps>>;
  onNext: () => void;
  serviceOptions: { label: string; value: string }[];
  registerValidator?: (fn: () => boolean) => void;
};

type OptionKey = FormFieldType | "medication" | "service-group";

type OptionProp = {
  name: string;
  key: OptionKey;
};

const addOptions: OptionProp[] = [
  {
    name: "Long Text",
    key: "textarea",
  },
  {
    name: "Short Text",
    key: "input",
  },
  {
    name: "Number",
    key: "number",
  },
  {
    name: "Select List",
    key: "dropdown",
  },
  {
    name: "Single Choice",
    key: "radio",
  },
  {
    name: "Multiple Choice",
    key: "checkbox",
  },
  {
    name: "Yes / No",
    key: "boolean",
  },
  {
    name: "Date",
    key: "date",
  },
  {
    name: "Signature",
    key: "signature",
  },
  {
    name: "Field Group",
    key: "group",
  },
  {
    name: "Medications",
    key: "medication",
  },
  {
    name: "Services",
    key: "service-group",
  },
];

type BuilderComponentProps = {
  field: FormField;
  onChange: (f: FormField) => void;
  createField?: (t: OptionKey) => FormField;
};

const builderComponentMap: Record<FormFieldType, React.ComponentType<BuilderComponentProps>> = {
  textarea: TextBuilder as any,
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
  { label: "Option 1", value: "option_1" },
  { label: "Option 2", value: "option_2" },
];

const defaultRadioOptions = [
  { label: "Option A", value: "option_a" },
  { label: "Option B", value: "option_b" },
];

const fieldFactory: Record<OptionKey, (id: string, serviceOptions?: { label: string; value: string }[]) => FormField> = {
  medication: (id) => ({
    id,
    type: "group",
    label: "Medication",
    meta: { medicationGroup: true } as any,
    fields: buildMedicationFields(`${id}-med`, "-"),
  }),
  textarea: (id) => ({ id, type: "textarea", label: "Text area", placeholder: "" }),
  input: (id) => ({ id, type: "input", label: "Input", placeholder: "" }),
  number: (id) => ({ id, type: "number", label: "Number", placeholder: "" }),
  dropdown: (id) => ({
    id,
    type: "dropdown",
    label: "Dropdown",
    options: defaultDropdownOptions.map((option) => ({ ...option })),
    multiple: false,
  }),
  radio: (id) => ({
    id,
    type: "radio",
    label: "Radio",
    options: defaultRadioOptions.map((option) => ({ ...option })),
    multiple: false,
  }),
  checkbox: (id) => ({
    id,
    type: "checkbox",
    label: "Checkbox",
    options: defaultDropdownOptions.map((option) => ({ ...option })),
    multiple: true,
  }),
  boolean: (id) => ({ id, type: "boolean", label: "Yes / No" }),
  date: (id) => ({ id, type: "date", label: "Date" }),
  signature: (id) => ({ id, type: "signature", label: "Signature" }),
  group: (id) => ({ id, type: "group", label: "Group", fields: [] }),
  "service-group": (id, serviceOptions = []) => ({
    id,
    type: "group",
    label: "Services",
    meta: { serviceGroup: true } as any,
    fields: [],
  }),
};

const AddFieldDropdown: React.FC<{
  onSelect: (key: OptionKey) => void;
  buttonClassName?: string;
}> = ({ onSelect, buttonClassName }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(dropdownRef, () => setOpen(false));

  return (
    <div className={`relative ${buttonClassName ?? ""}`} ref={dropdownRef}>
      <IoIosAddCircleOutline
        size={28}
        color="#302f2e"
        onClick={() => setOpen((e) => !e)}
        className="cursor-pointer"
      />
      {open && (
        <div className="absolute top-[120%] z-10 right-0 rounded-2xl border border-grey-noti bg-white shadow-md! flex flex-col items-center w-[160px]">
          {addOptions.map((option, i) => (
            <button
              key={option.key}
              onClick={() => {
                onSelect(option.key);
                setOpen(false);
              }}
              className={`${i === 0 ? "border-t-0!" : "border-t! border-t-grey-light!"} font-grotesk font-medium text-[16px] text-black-text text-left px-3 py-2 w-full`}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const isTreatmentPlanGroup = (
  field: FormField
): field is FormField & { type: "group" } =>
  field.id === "treatment_plan" && field.type === "group";

const isMedicationGroup = (field: FormField): field is FormField & { type: "group" } =>
  field.type === "group" && Boolean((field as any).meta?.medicationGroup);

const isServiceGroup = (field: FormField): field is FormField & { type: "group" } =>
  field.type === "group" && Boolean((field as any).meta?.serviceGroup);

const getServiceCheckbox = (
  field: FormField & { type: "group"; fields?: FormField[] }
): (FormField & { type: "checkbox"; options?: { label: string; value: string }[] }) | undefined =>
  (field.fields ?? []).find(
    (f): f is FormField & { type: "checkbox"; options?: { label: string; value: string }[] } =>
      f.type === "checkbox"
  );

const ensureServiceCheckbox = (
  field: FormField & { type: "group" },
  serviceOptions: { label: string; value: string }[]
): { group: FormField & { type: "group" }; selected: string[] } => {
  const existingCheckbox = getServiceCheckbox(field);
  const selected = existingCheckbox?.options?.map((opt) => opt.value) ?? [];

  const checkbox: FormField = {
    id: existingCheckbox?.id || `${field.id}_services`,
    type: "checkbox",
    label: "", // Empty label to avoid duplicate "Services" text
    options: selected.map((val) => {
      const match = serviceOptions.find((o) => o.value === val);
      return match ?? { label: val, value: val };
    }),
    multiple: true,
  };

  const otherFields = (field.fields ?? []).filter((f) => f.id !== checkbox.id);

  return {
    group: {
      ...field,
      fields: [...otherFields, checkbox],
    },
    selected,
  };
};

const buildLabeledMedication = (
  fields: FormField[] | undefined,
  baseMedication: FormField
) => {
  const medCount = (fields ?? []).filter(isMedicationGroup).length;
  return { ...baseMedication, label: `Medication ${medCount + 1}` };
};

const addFieldToTreatmentPlan = (
  schema: FormField[],
  fieldToAdd: FormField
): FormField[] =>
  schema.map((field) =>
    isTreatmentPlanGroup(field)
      ? { ...field, fields: [...(field.fields ?? []), fieldToAdd] }
      : field
  );
const updateServiceGroupOptions = (
  field: FormField & { type: "group" },
  serviceOptions: { label: string; value: string }[]
): FormField => {
  const checkbox = getServiceCheckbox(field);
  if (!checkbox) return field;
  const selectedValues = (checkbox.options ?? []).map((opt) => opt.value);

  const mappedOptions = serviceOptions.map((opt) => ({ ...opt }));
  const missingSelected = selectedValues.filter(
    (val: string) => !mappedOptions.some((opt) => opt.value === val)
  );
  const mergedOptions = [
    ...mappedOptions,
    ...missingSelected.map((val: string) => ({ label: val, value: val })),
  ];

  const updatedCheckbox = { ...checkbox, options: mergedOptions };
  return {
    ...field,
    fields: (field.fields ?? []).map((f) =>
      f.id === checkbox.id ? updatedCheckbox : f
    ),
  };
};
const addMedicationToTreatmentPlan = (
  schema: FormField[],
  medicationField: FormField
) =>
  schema.map((field) => {
    if (!isTreatmentPlanGroup(field)) return field;
    const labeledMed = buildLabeledMedication(field.fields, medicationField);
    return { ...field, fields: [...(field.fields ?? []), labeledMed] };
  });

const useOutsideClick = (
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void
) => {
  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    },
    [ref, onClose]
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);
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
    >
      <Component field={field} onChange={onChange} createField={createField} />
    </BuilderWrapper>
  );
};

type GroupBuilderProps = {
  field: FormField & { type: "group"; fields?: FormField[] };
  onChange: (f: FormField) => void;
  createField: (t: OptionKey) => FormField;
  serviceOptions: { label: string; value: string }[];
};

const GroupBuilder: React.FC<GroupBuilderProps> = ({
  field,
  onChange,
  createField,
  serviceOptions,
}) => {
  const groupField: FormField & { type: "group"; fields?: FormField[] } = {
    ...field,
    fields: field.fields ?? [],
  };

  if (isServiceGroup(field)) {
    const { group, selected } = ensureServiceCheckbox(groupField, serviceOptions);
    const checkbox = getServiceCheckbox(group);

    const updateOptions = (values: string[]) => {
      const nextCheckbox = {
        ...(checkbox as any),
        options: values.map((val) => {
          const match = serviceOptions.find((o) => o.value === val);
          return match ?? { label: val, value: val };
        }),
      };
      onChange({
        ...group,
        fields: (group.fields ?? []).map((f) =>
          f.id === checkbox?.id ? (nextCheckbox as FormField) : f
        ),
      });
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="font-grotesk text-black-text text-[18px] font-medium">
            {group.label || "Services"}
          </div>
        </div>
        <FormInput
          intype="text"
          inname={`group-${group.id}-label`}
          value={group.label || ""}
          inlabel="Group name"
          onChange={(e) => onChange({ ...group, label: e.target.value })}
          className="min-h-12!"
        />
        <MultiSelectDropdown
          placeholder="Select services"
          value={selected}
          onChange={updateOptions}
          options={serviceOptions}
        />
      </div>
    );
  }

  const updateNestedField = (id: string, updatedField: FormField) => {
    onChange({
      ...groupField,
      fields: (groupField.fields ?? []).map((f) =>
        f.id === id ? updatedField : f
      ),
    });
  };

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
        <div className="font-grotesk text-black-text text-[18px] font-medium">
          {groupField.label || "Group"}
        </div>
        <AddFieldDropdown onSelect={addNestedField} />
      </div>

      <FormInput
        intype="text"
        inname={`group-${groupField.id}-label`}
        value={groupField.label || ""}
        inlabel="Group name"
        onChange={(e) => onChange({ ...groupField, label: e.target.value })}
        className="min-h-12!"
      />

      {(groupField.fields ?? []).map((nested) => {
        if (nested.type === "group") {
          // Check if this is a medication group
          if (isMedicationGroup(nested)) {
            return (
              <BuilderWrapper
                key={nested.id}
                field={nested}
                onDelete={() => removeNestedField(nested.id)}
              >
                <MedicationGroupBuilder
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
      {(medField as any).meta?.readonly && (
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
  if (nested.type === "group") {
    const groupField = nested as FormField & { fields?: FormField[] };
    return (
      <BuilderWrapper
        key={nested.id}
        field={nested}
        onDelete={() => removeMedicine(nested.id)}
      >
        <div className="flex flex-col gap-3 border border-grey-light rounded-2xl p-3">
          <div className="font-grotesk text-black-text text-[16px] font-medium">
            {nested.label}
          </div>
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
      createField={createField}
    />
  );
};

type MedicationGroupBuilderProps = {
  field: FormField & { type: "group"; fields?: FormField[] };
  onChange: (f: FormField) => void;
  createField: (t: OptionKey) => FormField;
};

const MedicationGroupBuilder: React.FC<MedicationGroupBuilderProps> = ({
  field,
  onChange,
  createField,
}) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const [medicines, setMedicines] = useState<InventoryApiItem[]>([]);
  const [selectedMedicines, setSelectedMedicines] = useState<string[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);

  useEffect(() => {
    if (!primaryOrgId) return;
    setLoadingMedicines(true);
    fetchInventoryItems(primaryOrgId, { category: "Medicine" })
      .then((items) => setMedicines(items))
      .catch((err) => console.error("Failed to load medicines:", err))
      .finally(() => setLoadingMedicines(false));
  }, [primaryOrgId]);

  const medicineOptions = medicines.map((med) => ({
    label: med.name,
    value: med._id,
  }));

  const handleMedicineSelect = (medicineId: string) => {
    if (!medicineId || selectedMedicines.includes(medicineId)) return;

    const medicine = medicines.find((m) => m._id === medicineId);
    if (!medicine) return;

    // Create individual medication fields directly (not a nested group)
    const medicineCount = (field.fields ?? []).length + 1;
    const fieldPrefix = `${field.id}_med_${medicineCount}`;

    const medicationFields: FormField[] = [
      {
        id: `${fieldPrefix}_name`,
        type: "input",
        label: "Name",
        placeholder: medicine.name,
        defaultValue: medicine.name,
        meta: { readonly: true } as any,
      },
      {
        id: `${fieldPrefix}_dosage`,
        type: "input",
        label: "Dosage",
        placeholder: medicine.attributes?.strength || "Enter dosage",
        defaultValue: medicine.attributes?.strength || "",
        meta: { readonly: true } as any,
      },
      {
        id: `${fieldPrefix}_route`,
        type: "input",
        label: "Route / Administration",
        placeholder: medicine.attributes?.administration || "N/A",
        defaultValue: medicine.attributes?.administration || "",
        meta: { readonly: true } as any,
      },
      {
        id: `${fieldPrefix}_frequency`,
        type: "input",
        label: "Frequency",
        placeholder: "Enter frequency",
      },
      {
        id: `${fieldPrefix}_duration`,
        type: "input",
        label: "Duration",
        placeholder: "Enter duration",
      },
      {
        id: `${fieldPrefix}_price`,
        type: "number",
        label: "Price",
        placeholder: medicine.sellingPrice === null ? "" : String(medicine.sellingPrice),
        defaultValue: medicine.sellingPrice === null ? "" : String(medicine.sellingPrice),
        meta: { readonly: true } as any,
      },
      {
        id: `${fieldPrefix}_remark`,
        type: "textarea",
        label: "Remark",
        placeholder: "Add remark",
      },
    ];

    // Create a group for this specific medicine
    const newMedicineGroup: FormField = {
      id: `${fieldPrefix}_group`,
      type: "group",
      label: medicine.name,
      fields: medicationFields,
      meta: {
        medicineId: medicineId,
        medicineName: medicine.name,
      } as any,
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

  const updateNestedField = (id: string, updatedField: FormField) => {
    onChange({
      ...field,
      fields: (field.fields ?? []).map((f) =>
        f.id === id ? updatedField : f
      ),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="font-grotesk text-black-text text-[18px] font-medium">
          {field.label || "Medication"}
        </div>
      </div>

      <FormInput
        intype="text"
        inname={`group-${field.id}-label`}
        value={field.label || ""}
        inlabel="Group name"
        onChange={(e) => onChange({ ...field, label: e.target.value })}
        className="min-h-12!"
      />

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

      {(field.fields ?? []).map((nested) => renderNestedField(nested, updateNestedField, removeMedicine, createField))}
    </div>
  );
};

const Build = ({
  formData,
  setFormData,
  onNext,
  serviceOptions,
  registerValidator,
}: BuildProps) => {
  const [buildError, setBuildError] = useState<string>("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const builderRef = React.useRef<HTMLDivElement | null>(null);
  const scrollVelocityRef = React.useRef<number>(0);
  const scrollAnimRef = React.useRef<number | null>(null);
  const createField = (key: OptionKey): FormField => {
    const id = crypto.randomUUID();
    return fieldFactory[key](id, serviceOptions);
  };

  const updateFieldInForm = (
    prev: FormsProps,
    fieldId: string,
    updatedField: FormField
  ): FormsProps => ({
    ...prev,
    schema: (prev.schema || []).map((field) =>
      field.id === fieldId ? updatedField : field
    ),
  });

  const handleFieldChange = (fieldId: string, updatedField: FormField) => {
    setFormData((prev) => updateFieldInForm(prev, fieldId, updatedField));
  };

  const removeFieldById = (form: FormsProps, id: string): FormsProps => ({
    ...form,
    schema: (form.schema || []).filter((field) => field.id !== id),
  });

  const addMedicationGroup = () => {
    setFormData((prev) => {
      const medField = createField("medication");
      const updatedSchema = addMedicationToTreatmentPlan(prev.schema ?? [], medField);
      return { ...prev, schema: updatedSchema };
    });
  };

  const addField = (key: OptionKey) => {
    const hasTreatmentPlan =
      formData.schema?.some(
        (f) => f.id === "treatment_plan" && f.type === "group"
      ) ?? false;

    if (key === "medication" && hasTreatmentPlan) {
      addMedicationGroup();
      return;
    }

    const newField: FormField =
      key === "service-group"
        ? ensureServiceCheckbox(
            createField(key) as FormField & { type: "group" },
            serviceOptions
          ).group
        : createField(key);
    setFormData((prev) => ({
      ...prev,
      schema: [...(prev.schema ?? []), newField],
    }));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    setFormData((prev) => {
      const schema = [...(prev.schema ?? [])];
      const newIndex = direction === "up" ? index - 1 : index + 1;

      if (newIndex < 0 || newIndex >= schema.length) return prev;

      const temp = schema[index];
      schema[index] = schema[newIndex];
      schema[newIndex] = temp;

      return { ...prev, schema };
    });
  };

  const reorderField = (from: number, to: number) => {
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
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    if (dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const scrollable =
      builderRef.current && builderRef.current.scrollHeight > builderRef.current.clientHeight
        ? builderRef.current
        : (document.scrollingElement as HTMLElement | null);

    if (scrollable) {
      const rect =
        scrollable === builderRef.current
          ? scrollable.getBoundingClientRect()
          : { top: 0, bottom: window.innerHeight, height: window.innerHeight };
      const softZone = Math.min(300, (rect.bottom - rect.top) / 2);
      const turboZone = softZone / 3;
      const distanceToTop = Math.max(0, e.clientY - rect.top);
      const distanceToBottom = Math.max(0, rect.bottom - e.clientY);

      if (distanceToTop < softZone && scrollable.scrollTop > 0) {
        const ratio = (softZone - distanceToTop) / softZone;
        const turbo = distanceToTop < turboZone ? 14 : 0;
        const speed = Math.min(30, Math.max(6, ratio * 20 + turbo));
        scrollVelocityRef.current = -speed;
      } else if (distanceToBottom < softZone) {
        const ratio = (softZone - distanceToBottom) / softZone;
        const turbo = distanceToBottom < turboZone ? 14 : 0;
        const speed = Math.min(30, Math.max(6, ratio * 20 + turbo));
        scrollVelocityRef.current = speed;
      } else {
        scrollVelocityRef.current = 0;
      }

      if (scrollAnimRef.current === null) {
        const step = () => {
          const vel = scrollVelocityRef.current;
          if (!scrollable) {
            scrollAnimRef.current = null;
            return;
          }
          if (vel !== 0) {
            scrollable.scrollTop += vel;
            scrollAnimRef.current = requestAnimationFrame(step);
          } else {
            scrollAnimRef.current = null;
          }
        };
        scrollAnimRef.current = requestAnimationFrame(step);
      }
    }
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
        isServiceGroup(field)
          ? ensureServiceCheckbox(field, serviceOptions).group
          : field
      ),
    }));
  }, [serviceOptions, setFormData]);

  const validate = React.useCallback(() => {
    if (!formData.schema || formData.schema.length === 0) {
      setBuildError("Add at least one field to continue.");
      return false;
    }
    setBuildError("");
    return true;
  }, [formData.schema]);

  React.useEffect(() => {
    registerValidator?.(validate);
  }, [registerValidator, validate]);

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between" ref={builderRef}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="font-grotesk text-black-text text-[23px] font-medium">
            Build form
          </div>
          <AddFieldDropdown onSelect={addField} buttonClassName="w-fit" />
        </div>

        {formData.schema?.map((field, index) => {
          const fieldId = field.id; // Store ID to avoid TypeScript narrowing issues
          const canMoveUp = index > 0;
          const canMoveDown = index < (formData.schema?.length ?? 0) - 1;

          if (field.type === "group") {
            // Handle medication groups separately
            if (isMedicationGroup(field)) {
              const isDragging = dragIndex === index;
              return (
                <BuilderWrapper
                  key={fieldId}
                  field={field}
                  onDelete={() =>
                    setFormData((prev) => removeFieldById(prev, fieldId))
                  }
                  onMoveUp={() => moveField(index, "up")}
                  onMoveDown={() => moveField(index, "down")}
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  isDragging={isDragging}
                >
                  <MedicationGroupBuilder
                    field={field}
                    onChange={(updatedField) =>
                      handleFieldChange(fieldId, updatedField)
                    }
                    createField={createField}
                  />
                </BuilderWrapper>
              );
            }

            // Handle service groups and regular groups
            if (isServiceGroup(field)) {
              const ensured = ensureServiceCheckbox(field, serviceOptions).group;
              const isDragging = dragIndex === index;
              return (
                <BuilderWrapper
                  key={ensured.id}
                  field={ensured}
                  onDelete={() =>
                    setFormData((prev) => removeFieldById(prev, fieldId))
                  }
                  onMoveUp={() => moveField(index, "up")}
                  onMoveDown={() => moveField(index, "down")}
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  isDragging={isDragging}
                >
                  <GroupBuilder
                    field={ensured}
                    onChange={(updatedField) =>
                      handleFieldChange(fieldId, updatedField)
                    }
                    createField={createField}
                    serviceOptions={serviceOptions}
                  />
                </BuilderWrapper>
              );
            }

            // Regular groups
            return (
              <BuilderWrapper
                key={fieldId}
                field={field}
                onDelete={() =>
                  setFormData((prev) => removeFieldById(prev, fieldId))
                }
                onMoveUp={() => moveField(index, "up")}
                onMoveDown={() => moveField(index, "down")}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                draggable
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
                onDragEnd={handleDragEnd}
                isDragging={dragIndex === index}
              >
                <GroupBuilder
                  field={field}
                  onChange={(updatedField) =>
                    handleFieldChange(fieldId, updatedField)
                  }
                  createField={createField}
                  serviceOptions={serviceOptions}
                />
              </BuilderWrapper>
            );
          }
          return (
            <FieldBuilder
              key={fieldId}
              field={field}
              onChange={(updatedField) =>
                handleFieldChange(fieldId, updatedField)
              }
              onDelete={() =>
                setFormData((prev) => removeFieldById(prev, fieldId))
              }
              onMoveUp={() => moveField(index, "up")}
              onMoveDown={() => moveField(index, "down")}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              createField={createField}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
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
        <div className="flex flex-col items-center gap-2 py-4 border-2 border-dashed border-grey-light rounded-2xl hover:border-grey-noti transition-colors">
          <div className="flex flex-col items-center gap-1">
            <AddFieldDropdown
              onSelect={addField}
              buttonClassName="w-fit"
            />
            <span className="text-sm font-satoshi font-medium text-grey-noti">
              Add Field
            </span>
          </div>
        </div>
      </div>
      <div className="px-3 pb-3 flex justify-center">
        <Primary
          href="#"
          text="Next"
          onClick={onNext}
          classname="w-fit"
        />
      </div>
    </div>
  );
};

export default Build;
