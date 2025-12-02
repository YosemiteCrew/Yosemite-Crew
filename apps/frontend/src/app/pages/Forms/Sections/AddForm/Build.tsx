import { Primary } from "@/app/components/Buttons";
import { FormField, FormFieldType, FormsProps } from "@/app/types/forms";
import React, { useEffect, useRef, useState } from "react";
import { IoIosAddCircleOutline } from "react-icons/io";
import TextBuilder from "./components/Text/TextBuilder";
import InputBuilder from "./components/Input/InputBuilder";
import DropdownBuilder from "./components/Dropdown/DropdownBuilder";
import SignatureBuilder from "./components/Signature/SignatureBuilder";
import BuilderWrapper from "./components/BuildWrapper";

type BuildProps = {
  formData: FormsProps;
  setFormData: React.Dispatch<React.SetStateAction<FormsProps>>;
};

type OptionProp = {
  name: string;
  key: FormFieldType;
};

const addOptions: OptionProp[] = [
  {
    name: "Text",
    key: "text",
  },
  {
    name: "Input",
    key: "input",
  },
  {
    name: "Dropdown",
    key: "dropdown",
  },
  {
    name: "Signature",
    key: "signature",
  },
];

const builderComponentMap: Record<
  FormFieldType,
  React.ComponentType<{ field: any; onChange: (f: FormField) => void }>
> = {
  text: TextBuilder,
  input: InputBuilder,
  dropdown: DropdownBuilder,
  signature: SignatureBuilder,
};

export const FieldBuilder: React.FC<{
  field: FormField;
  onChange: (f: FormField) => void;
  onDelete: () => void;
}> = ({ field, onChange, onDelete }) => {
  const Component = builderComponentMap[field.type];

  return (
    <BuilderWrapper field={field} onDelete={onDelete}>
      <Component field={field} onChange={onChange} />
    </BuilderWrapper>
  );
};

const Build = ({ formData, setFormData }: BuildProps) => {
  const [addModal, setAddModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updateFieldInForm = (
    prev: FormsProps,
    fieldId: string,
    updatedField: FormField
  ): FormsProps => ({
    ...prev,
    fields: (prev.fields || []).map((field) =>
      field.id === fieldId ? updatedField : field
    ),
  });

  const handleFieldChange = (fieldId: string, updatedField: FormField) => {
    setFormData((prev) => updateFieldInForm(prev, fieldId, updatedField));
  };

  const removeFieldById = (form: FormsProps, id: string): FormsProps => ({
    ...form,
    fields: (form.fields || []).filter((field) => field.id !== id),
  });

  const addField = (key: FormFieldType) => {
    const newField: FormField = (() => {
      switch (key) {
        case "text":
          return {
            id: crypto.randomUUID(),
            type: "text",
            value: "",
          };
        case "input":
          return {
            id: crypto.randomUUID(),
            type: "input",
            label: "Input Field",
            value: "",
          };
        case "dropdown":
          return {
            id: crypto.randomUUID(),
            type: "dropdown",
            label: "Dropdown Field",
            options: [],
          };
        case "signature":
          return {
            id: crypto.randomUUID(),
            type: "signature",
            label: "Signature",
          };
      }
    })();
    setFormData((prev) => ({
      ...prev,
      fields: [...(prev.fields ?? []), newField],
    }));
    setAddModal(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setAddModal(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="font-grotesk text-black-text text-[23px] font-medium">
            Build form
          </div>
          <div className="relative" ref={dropdownRef}>
            <IoIosAddCircleOutline
              size={28}
              color="#302f2e"
              onClick={() => setAddModal((e) => !e)}
              className="cursor-pointer"
            />
            {addModal && (
              <div className="absolute top-[120%] z-10 right-0 rounded-2xl border border-grey-noti bg-white shadow-md! flex flex-col items-center w-[120px]">
                {addOptions.map((option, i) => (
                  <button
                    key={option.key}
                    onClick={() => addField(option.key)}
                    className={`${i === 0 ? "border-t-0!" : "border-t! border-t-grey-light!"} font-grotesk font-medium text-[16px] text-black-text text-center py-2 w-full`}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {formData.fields?.map((field) => (
          <FieldBuilder
            key={field.id}
            field={field}
            onChange={(updatedField) =>
              handleFieldChange(field.id, updatedField)
            }
            onDelete={() =>
              setFormData((prev) => removeFieldById(prev, field.id))
            }
          />
        ))}
      </div>
      <Primary
        href="#"
        text="Save"
        classname="max-h-12! text-lg! tracking-wide!"
      />
    </div>
  );
};

export default Build;
