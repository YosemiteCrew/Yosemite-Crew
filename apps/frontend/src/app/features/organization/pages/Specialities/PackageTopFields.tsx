import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import NameDescriptionFields from '@/app/features/organization/pages/Specialities/NameDescriptionFields';
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
    <NameDescriptionFields
      name={name}
      onNameChange={onNameChange}
      nameError={nameError}
      descId={descId}
      description={description}
      onDescriptionChange={onDescriptionChange}
    />

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
