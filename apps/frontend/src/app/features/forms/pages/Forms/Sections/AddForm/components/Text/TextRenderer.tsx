import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import { FormField } from '@/app/features/forms/types/forms';

/**
 * `FormRenderer` passes `readOnly` to every runtime renderer, but the map casts
 * each one through `as any`, so a renderer that simply does not declare the prop
 * loses it without a type error. This one did: a read-only form - the preview
 * drawer and any submitted form opened for reading - kept a fully editable
 * textarea, and typing in it still fired `onChange`.
 */
const TextRenderer: React.FC<{
  field: FormField & { type: 'textarea' };
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly = false }) => (
  <div className="flex flex-col gap-3">
    <FormDesc
      intype="text"
      inname={field.id}
      value={value ?? ''}
      inlabel={field.label || ''}
      readonly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-[120px]! max-h-[140px]!"
    />
  </div>
);

export default TextRenderer;
