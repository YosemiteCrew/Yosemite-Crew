import { Primary } from "@/app/components/Buttons";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { FormField, FormFieldType, FormsProps, buildMedicationFields } from "@/app/types/forms";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { IoIosAddCircleOutline } from "react-icons/io";
import TextBuilder from "./components/Text/TextBuilder";
import InputBuilder from "./components/Input/InputBuilder";
import DropdownBuilder from "./components/Dropdown/DropdownBuilder";
import SignatureBuilder from "./components/Signature/SignatureBuilder";
import BuilderWrapper from "./components/BuildWrapper";
import BooleanBuilder from "./components/Boolean/BooleanBuilder";
import DateBuilder from "./components/Date/DateBuilder";

type BuildProps = {
  formData: FormsProps;
  setFormData: React.Dispatch<React.SetStateAction<FormsProps>>;
  onNext: () => void;
};

type OptionKey = FormFieldType | "medication";

type OptionProp = {
  name: string;
  key: OptionKey;
};

const addOptions: OptionProp[] = [
  {
    name: "Text area",
    key: "textarea",
  },
  {
    name: "Input",
    key: "input",
  },
  {
    name: "Number",
    key: "number",
  },
  {
    name: "Dropdown",
    key: "dropdown",
  },
  {
    name: "Radio",
    key: "radio",
  },
  {
    name: "Checkbox",
    key: "checkbox",
  },
  {
    name: "Boolean",
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
    name: "Group",
    key: "group",
  },
  {
    name: "Medication group",
    key: "medication",
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

const fieldFactory: Record<OptionKey, (id: string) => FormField> = {
  medication: (id) => ({
    id,
    type: "group",
    label: "Medication",
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

const isMedicationGroup = (field: FormField) =>
  field.type === "group" && (field.label || "").toLowerCase().includes("medication");

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
  createField: (t: OptionKey) => FormField;
}> = ({ field, onChange, onDelete, createField }) => {
  const Component = builderComponentMap[field.type];

  return (
    <BuilderWrapper field={field} onDelete={onDelete}>
      <Component field={field} onChange={onChange} createField={createField} />
    </BuilderWrapper>
  );
};

type GroupBuilderProps = {
  field: FormField & { type: "group"; fields?: FormField[] };
  onChange: (f: FormField) => void;
  createField: (t: OptionKey) => FormField;
};

const GroupBuilder: React.FC<GroupBuilderProps> = ({
  field,
  onChange,
  createField,
}) => {
  const updateNestedField = (id: string, updatedField: FormField) => {
    onChange({
      ...field,
      fields: (field.fields ?? []).map((f) => (f.id === id ? updatedField : f)),
    });
  };

  const removeNestedField = (id: string) =>
    onChange({
      ...field,
      fields: (field.fields ?? []).filter((f) => f.id !== id),
    });

  const addNestedField = (key: OptionKey) => {
    const newField = createField(key);
    onChange({
      ...field,
      fields: [...(field.fields ?? []), newField],
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="font-grotesk text-black-text text-[18px] font-medium">
          {field.label || "Group"}
        </div>
        <AddFieldDropdown onSelect={addNestedField} />
      </div>

      <FormInput
        intype="text"
        inname={`group-${field.id}-label`}
        value={field.label || ""}
        inlabel="Group name"
        onChange={(e) => onChange({ ...field, label: e.target.value })}
        className="min-h-12!"
      />

      {(field.fields ?? []).map((nested) =>
        nested.type === "group" ? (
          <BuilderWrapper
            key={nested.id}
            field={nested}
            onDelete={() => removeNestedField(nested.id)}
          >
            <GroupBuilder
              field={nested as FormField & { type: "group" }}
              onChange={(updated) => updateNestedField(nested.id, updated)}
              createField={createField}
            />
          </BuilderWrapper>
        ) : (
          <FieldBuilder
            key={nested.id}
            field={nested}
            onChange={(updated) => updateNestedField(nested.id, updated)}
            onDelete={() => removeNestedField(nested.id)}
            createField={createField}
          />
        )
      )}
    </div>
  );
};

const Build = ({ formData, setFormData, onNext }: BuildProps) => {
  const createField = (key: OptionKey): FormField => {
    const id = crypto.randomUUID();
    return fieldFactory[key](id);
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

    const newField: FormField = createField(key);
    setFormData((prev) => ({
      ...prev,
      schema: [...(prev.schema ?? []), newField],
    }));
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="font-grotesk text-black-text text-[23px] font-medium">
            Build form
          </div>
          <AddFieldDropdown onSelect={addField} buttonClassName="w-fit" />
        </div>

        {formData.schema?.map((field) => {
          if (field.type === "group") {
            return (
              <BuilderWrapper
                key={field.id}
                field={field}
                onDelete={() =>
                  setFormData((prev) => removeFieldById(prev, field.id))
                }
              >
                <GroupBuilder
                  field={field}
                  onChange={(updatedField) =>
                    handleFieldChange(field.id, updatedField)
                  }
                  createField={createField}
                />
              </BuilderWrapper>
            );
          }
          return (
            <FieldBuilder
              key={field.id}
              field={field}
              onChange={(updatedField) =>
                handleFieldChange(field.id, updatedField)
              }
              onDelete={() =>
                setFormData((prev) => removeFieldById(prev, field.id))
              }
              createField={createField}
            />
          );
        })}
      </div>
      <Primary
        href="#"
        text="Next"
        classname="max-h-12! text-lg! tracking-wide!"
        onClick={onNext}
      />
    </div>
  );
};

export default Build;
