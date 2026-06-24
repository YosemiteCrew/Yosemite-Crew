import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { FormField } from '@/app/features/forms/types/forms';

/**
 * Builder block for a rich-text field. The author sets a label and the default
 * (prefill) content that the form/template loads with. Used by SOAP / Discharge
 * templates so the prefilled clinical text renders with formatting.
 */
const RichTextBuilder: React.FC<{
  field: FormField & { type: 'richtext' };
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => (
  <div className="flex flex-col gap-3">
    <FormInput
      intype="text"
      inname="Label"
      value={field.label || ''}
      inlabel="Label"
      onChange={(e) => onChange({ ...field, label: e.target.value })}
      className="min-h-12!"
    />
    <RichTextEditor
      ariaLabel={`${field.label || 'Rich text'} default content`}
      value={typeof field.defaultValue === 'string' ? field.defaultValue : ''}
      onChange={(html) => onChange({ ...field, defaultValue: html })}
      placeholder="Default content shown when the form loads…"
      toolbarPlacement="inline"
    />
  </div>
);

export default RichTextBuilder;
