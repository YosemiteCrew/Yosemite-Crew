import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { FormField } from '@/app/features/forms/types/forms';

type InputField = FormField & { type: 'input' | 'number' };

// Every label, fallback and input type this builder can show is decided here, so
// the component itself is a plain read-only / template / editable three-way render.
const buildInputBuilderModel = (field: InputField) => {
  const meta = (field as any).meta;
  const defaultValue = (field as any).defaultValue;
  const isReadOnly = Boolean(meta?.readonly);
  const isTaskBlockField = Boolean(meta?.taskBlockKey);

  return {
    isReadOnly,
    isTemplateValueField:
      !isReadOnly && Boolean(meta?.inventoryItemId || meta?.taskBlockKey || meta?.templateDefault),
    valueInputType: field.type === 'number' ? ('number' as const) : ('text' as const),
    labelText: field.label || '',
    headingText: field.label || 'Field',
    placeholderText: field.placeholder || '',
    displayValue: defaultValue ?? field.placeholder ?? '',
    defaultValueText: typeof defaultValue === 'string' ? defaultValue : '',
    readonlyLabel: isTaskBlockField ? 'Fixed setting' : 'Label (from inventory)',
    readonlyValueLabel: isTaskBlockField ? 'Fixed value' : 'Value (from inventory)',
  };
};

const InputBuilder: React.FC<{
  field: InputField;
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => {
  const model = buildInputBuilderModel(field);

  if (model.isReadOnly) {
    return (
      <div className="flex flex-col gap-3">
        <FormInput
          intype="text"
          inname="Label"
          value={model.labelText}
          inlabel={model.readonlyLabel}
          readonly={true}
        />
        <FormInput
          intype={model.valueInputType}
          inname="value"
          value={model.displayValue}
          inlabel={model.readonlyValueLabel}
          readonly={true}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {model.isTemplateValueField ? (
        <>
          <div className="font-satoshi text-black-text text-[16px] font-medium">
            {model.headingText}
          </div>
          <FormInput
            intype={model.valueInputType}
            inname="defaultValue"
            value={model.defaultValueText}
            inlabel="Default value (prefilled in workspace)"
            onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
          />
        </>
      ) : (
        <>
          <FormInput
            intype="text"
            inname="Label"
            value={model.labelText}
            inlabel="Label"
            onChange={(e) => onChange({ ...field, label: e.target.value })}
          />
          <FormInput
            intype={model.valueInputType}
            inname="placeholder"
            value={model.placeholderText}
            inlabel="Placeholder"
            onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
          />
        </>
      )}
    </div>
  );
};

export default InputBuilder;
