import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { LEAD_OPTIONS, STAFF_COUNT_OPTIONS } from './packageFormDraftHelpers';

type PackageTopFieldsProps = {
  name: string;
  onNameChange: (value: string) => void;
  nameError?: string;
  description: string;
  onDescriptionChange: (value: string) => void;
  descId: string;
  durationText: string;
  onDurationTextChange: (value: string) => void;
  durationTextError?: string;
  leadCount: string;
  onLeadCountSelect: (value: string) => void;
  supportCount: string;
  onSupportCountSelect: (value: string) => void;
  effectiveBookable: boolean;
  requiredBookable: boolean;
  onIsBookableChange: (value: boolean) => void;
  effectiveInpatientPreferred: boolean;
  requiredInpatient: boolean;
  onIsInpatientPreferredChange: (value: boolean) => void;
};

const PackageTopFields = ({
  name,
  onNameChange,
  nameError,
  description,
  onDescriptionChange,
  descId,
  durationText,
  onDurationTextChange,
  durationTextError,
  leadCount,
  onLeadCountSelect,
  supportCount,
  onSupportCountSelect,
  effectiveBookable,
  requiredBookable,
  onIsBookableChange,
  effectiveInpatientPreferred,
  requiredInpatient,
  onIsInpatientPreferredChange,
}: PackageTopFieldsProps) => (
  <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-x-6 gap-y-4 items-start">
    {/* Left col: Name + Description */}
    <div className="flex flex-col gap-4">
      <FormInput
        intype="text"
        inlabel="Name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        error={nameError}
      />
      <div className="relative w-full">
        <textarea
          id={descId}
          aria-label="Description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder=" "
          className="peer w-full rounded-2xl bg-transparent px-6 pt-4 pb-3 text-body-4 text-text-primary outline-none border border-input-border-default focus:border-input-border-active resize-none min-h-28"
        />
        <label
          htmlFor={descId}
          className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-2rem)] truncate text-body-4 text-input-text-placeholder transition-all duration-200 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-input-text-placeholder-active peer-focus:bg-(--whitebg) peer-focus:px-1.5 peer-focus:max-w-none peer-not-placeholder-shown:px-1.5 peer-not-placeholder-shown:-top-2.5 peer-not-placeholder-shown:left-4 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:bg-(--whitebg) peer-not-placeholder-shown:max-w-none"
        >
          Description
        </label>
      </div>
    </div>

    {/* Right col: Duration / Lead+Support row / scheduling checkboxes */}
    <div className="flex flex-col gap-4">
      <FormInput
        intype="text"
        inlabel="Approx. duration"
        value={durationText}
        onChange={(e) => onDurationTextChange(e.target.value)}
        error={durationTextError}
      />
      <div className="grid grid-cols-2 gap-4">
        <LabelDropdown
          placeholder="Lead"
          options={LEAD_OPTIONS}
          defaultOption={leadCount}
          onSelect={(o) => onLeadCountSelect(o.value)}
          portal
        />
        <LabelDropdown
          placeholder="Support"
          options={STAFF_COUNT_OPTIONS}
          defaultOption={supportCount}
          onSelect={(o) => onSupportCountSelect(o.value)}
          portal
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 cursor-pointer select-none text-body-4 text-text-secondary whitespace-nowrap">
          <input
            type="checkbox"
            aria-label="Package bookable"
            checked={effectiveBookable}
            disabled={requiredBookable}
            onChange={(e) => onIsBookableChange(e.target.checked)}
            className="size-4 shrink-0 accent-(--color-input-border-active) disabled:cursor-not-allowed"
          />
          {'Is this package bookable?'}
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none text-body-4 text-text-secondary whitespace-nowrap">
          <input
            type="checkbox"
            aria-label="Package in-patient"
            checked={effectiveInpatientPreferred}
            disabled={requiredInpatient}
            onChange={(e) => onIsInpatientPreferredChange(e.target.checked)}
            className="size-4 shrink-0 accent-(--color-input-border-active) disabled:cursor-not-allowed"
          />
          {'In-patient preferred'}
        </label>
      </div>
    </div>
  </div>
);

export default PackageTopFields;
