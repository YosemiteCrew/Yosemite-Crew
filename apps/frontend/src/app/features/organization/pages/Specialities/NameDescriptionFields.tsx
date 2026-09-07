import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { Textarea } from '@/app/ui/Input';

type NameDescriptionFieldsProps = {
  name: string;
  onNameChange: (value: string) => void;
  nameError?: string;
  descId: string;
  description: string;
  onDescriptionChange: (value: string) => void;
  textareaRows?: number;
};

/**
 * Left-column Name input + labeled Description textarea shared by the
 * package and service draft forms.
 */
const NameDescriptionFields = ({
  name,
  onNameChange,
  nameError,
  descId,
  description,
  onDescriptionChange,
  textareaRows,
}: NameDescriptionFieldsProps) => (
  <div className="flex flex-col gap-4">
    <FormInput
      intype="text"
      inlabel="Name"
      value={name}
      onChange={(e) => onNameChange(e.target.value)}
      error={nameError}
    />
    <div className="w-full">
      <label
        htmlFor={descId}
        className="mb-1.5 block truncate text-[12.5px] font-semibold text-[var(--ink-soft)]"
      >
        Description
      </label>
      <Textarea
        id={descId}
        aria-label="Description"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        rows={textareaRows}
        className="w-full rounded-2xl bg-transparent px-6 pt-4 pb-3 text-body-4 text-text-primary outline-none border border-input-border-default focus:border-input-border-active resize-none min-h-28"
      />
    </div>
  </div>
);

export default NameDescriptionFields;
