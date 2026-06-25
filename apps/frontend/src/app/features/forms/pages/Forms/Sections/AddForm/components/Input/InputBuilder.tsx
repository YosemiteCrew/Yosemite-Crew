import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { FormField } from '@/app/features/forms/types/forms';

const InputBuilder: React.FC<{
  field: FormField & { type: 'input' | 'number' };
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => {
  const isReadOnly = (field as any).meta?.readonly;
  const isTaskBlockField = Boolean((field as any).meta?.taskBlockKey);
  const displayValue = (field as any).defaultValue ?? field.placeholder ?? '';
  const isTemplateValueField =
    !isReadOnly &&
    Boolean(
      (field as any).meta?.inventoryItemId ||
      (field as any).meta?.taskBlockKey ||
      (field as any).meta?.templateDefault
    );
  const defaultValueText =
    typeof (field as any).defaultValue === 'string' ? (field as any).defaultValue : '';

  if (isReadOnly) {
    const label = isTaskBlockField ? 'Fixed setting' : 'Label (from inventory)';
    const valueLabel = isTaskBlockField ? 'Fixed value' : 'Value (from inventory)';
    return (
      <div className="flex flex-col gap-3">
        <FormInput
          intype="text"
          inname="Label"
          value={field.label || ''}
          inlabel={label}
          readonly={true}
          className="min-h-12!"
        />
        <FormInput
          intype={field.type === 'number' ? 'number' : 'text'}
          inname="value"
          value={displayValue}
          inlabel={valueLabel}
          readonly={true}
          className="min-h-12!"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {isTemplateValueField ? (
        <>
          <div className="font-satoshi text-black-text text-[16px] font-medium">
            {field.label || 'Field'}
          </div>
          <FormInput
            intype={field.type === 'number' ? 'number' : 'text'}
            inname="defaultValue"
            value={defaultValueText}
            inlabel="Default value (prefilled in workspace)"
            onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
            className="min-h-12!"
          />
        </>
      ) : (
        <>
          <FormInput
            intype="text"
            inname="Label"
            value={field.label || ''}
            inlabel="Label"
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            className="min-h-12!"
          />
          <FormInput
            intype={field.type === 'number' ? 'number' : 'text'}
            inname="placeholder"
            value={field.placeholder || ''}
            inlabel="Placeholder"
            onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
            className="min-h-12!"
          />
        </>
      )}
    </div>
  );
};

export default InputBuilder;
