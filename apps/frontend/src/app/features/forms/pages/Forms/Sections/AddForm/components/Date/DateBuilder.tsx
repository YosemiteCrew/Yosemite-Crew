import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { FormField } from '@/app/features/forms/types/forms';

/**
 * Label only, like `BooleanBuilder`. The Placeholder box that used to sit below it
 * was dead copy: `DateRenderer` never forwards `field.placeholder`, `FormInput` has
 * no `placeholder` prop, and `buildPreviewValues` deliberately skips the placeholder
 * fallback for `date` because a hint like `DD/MM/YYYY` is not a valid date value. A
 * native `<input type="date">` ignores the placeholder attribute anyway, so wiring it
 * through would mean widening the shared `FormInput` to emit something no browser
 * paints. Authors typed a hint that was silently discarded; now they are not asked.
 * Placeholders already stored on existing date fields survive - `onChange` still
 * spreads the whole field.
 */
const DateBuilder: React.FC<{
  field: FormField & { type: 'date' };
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => (
  <div className="flex flex-col gap-3">
    <FormInput
      intype="text"
      inname="Label"
      value={field.label || ''}
      inlabel="Label"
      onChange={(e) => onChange({ ...field, label: e.target.value })}
    />
  </div>
);

export default DateBuilder;
