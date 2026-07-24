import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { FormField } from '@/app/features/forms/types/forms';

const BooleanBuilder: React.FC<{
  field: FormField & { type: 'boolean' };
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

export default BooleanBuilder;
