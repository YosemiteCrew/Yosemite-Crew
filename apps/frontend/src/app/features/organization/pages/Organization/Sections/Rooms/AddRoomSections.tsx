import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import type React from 'react';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import Timepicker from '@/app/ui/inputs/Timepicker';
import {
  RoomDaysOptions,
  RoomEquipmentOptions,
  RoomSpeciesOptions,
  RoomsTypes,
} from '@/app/features/organization/pages/Organization/types';
import { OrganisationRoom } from '@yosemite-crew/types';
import { FiPlus } from 'react-icons/fi';
import type { RoomFormData, RoomUnitDraft } from './AddRoom';
import { SectionHeader, ToggleSwitch } from './roomSectionPrimitives';
import RoomUnitFieldsEditor from './RoomUnitFieldsEditor';

export { SectionHeader, ToggleSwitch };

type SelectOption = { label: string; value: string };
type OpenSections = Record<'details' | 'availability' | 'units' | 'equipment', boolean>;

export const BasicDetailsSection = ({
  formData,
  formDataErrors,
  open,
  specialitiesOptions,
  onToggle,
  onChange,
  onRoomTypeChange,
}: {
  formData: RoomFormData;
  formDataErrors: { name?: string; code?: string; type?: string };
  open: boolean;
  specialitiesOptions: SelectOption[];
  onToggle: () => void;
  onChange: (patch: Partial<RoomFormData>) => void;
  onRoomTypeChange: (type: OrganisationRoom['type']) => void;
}) => (
  <section className="flex flex-col gap-3">
    <SectionHeader title="Basic details" open={open} onToggle={onToggle} />
    {open && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormInput
          intype="text"
          inname="name"
          value={formData.name}
          inlabel="Name"
          onChange={(event) => onChange({ name: event.target.value })}
          error={formDataErrors.name}
        />
        <FormInput
          intype="text"
          inname="code"
          value={formData.code}
          inlabel="Room code"
          onChange={(event) => onChange({ code: event.target.value })}
          error={formDataErrors.code}
        />
        <div className="sm:col-span-2">
          <LabelDropdown
            placeholder="Room Type"
            onSelect={(option) => onRoomTypeChange(option.value as OrganisationRoom['type'])}
            defaultOption={formData.type}
            options={RoomsTypes}
            error={formDataErrors.type}
          />
        </div>
        <div className="sm:col-span-2">
          <MultiSelectDropdown
            placeholder="Speciality (optional)"
            value={formData.assignedSpecialiteis || []}
            onChange={(value) => onChange({ assignedSpecialiteis: value })}
            options={specialitiesOptions}
          />
        </div>
        <div className="sm:col-span-2 rounded-2xl border border-card-border bg-card-hover px-3 py-2 text-caption-1 text-text-secondary">
          Assign a specialty if this room is dedicated to a specific speciality or service.
        </div>
      </div>
    )}
  </section>
);

export const AvailabilitySection = ({
  formData,
  open,
  supportsUnits,
  teamOptions,
  onToggle,
  onAvailabilityChange,
  onChange,
}: {
  formData: RoomFormData;
  open: boolean;
  supportsUnits: boolean;
  teamOptions: SelectOption[];
  onToggle: () => void;
  onAvailabilityChange: (patch: Partial<RoomFormData['availability']>) => void;
  onChange: (patch: Partial<RoomFormData>) => void;
}) => (
  <section className="flex flex-col gap-3">
    <SectionHeader
      title="Availability"
      open={open}
      onToggle={onToggle}
      meta={<span className="text-body-4 text-text-primary">Available now</span>}
      action={
        <ToggleSwitch
          checked={formData.availability.isAvailable}
          label="Toggle room availability"
          onChange={(checked) => onAvailabilityChange({ isAvailable: checked })}
        />
      }
    />
    {open && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Timepicker
          label="Start time"
          name="startTime"
          value={formData.availability.startTime}
          onChange={(value) => onAvailabilityChange({ startTime: value })}
        />
        <Timepicker
          label="End time"
          name="endTime"
          value={formData.availability.endTime}
          onChange={(value) => onAvailabilityChange({ endTime: value })}
        />
        <LabelDropdown
          placeholder="Days"
          options={RoomDaysOptions}
          defaultOption={formData.availability.days}
          onSelect={(option) => onAvailabilityChange({ days: option.value })}
        />
        <MultiSelectDropdown
          placeholder="Species"
          value={formData.availability.species}
          onChange={(value) => onAvailabilityChange({ species: value })}
          options={RoomSpeciesOptions}
        />
        {supportsUnits ? (
          <FormInput
            intype="number"
            inname="totalUnits"
            value={String(formData.availability.totalUnits)}
            inlabel="Total Units"
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onAvailabilityChange({ totalUnits: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) });
            }}
          />
        ) : (
          <p className="sm:col-span-2 rounded-2xl border border-card-border px-3 py-2 text-caption-1 text-text-secondary">
            Units are available for ICU, Inpatient, Isolation, and Boarding rooms.
          </p>
        )}
        <div className="sm:col-span-2">
          <MultiSelectDropdown
            placeholder="Assigned Staff (optional)"
            value={formData.assignedStaffs || []}
            onChange={(value) => onChange({ assignedStaffs: value })}
            options={teamOptions}
          />
        </div>
      </div>
    )}
  </section>
);

export const UnitsSection = ({
  formData,
  open,
  supportsUnits,
  onAddUnit,
  onToggle,
  onUpdateUnit,
}: {
  formData: RoomFormData;
  open: boolean;
  supportsUnits: boolean;
  onAddUnit: () => void;
  onToggle: () => void;
  onUpdateUnit: (id: string, patch: Partial<RoomUnitDraft>) => void;
}) => (
  <section className="flex flex-col gap-3">
    <SectionHeader
      title={`Unit type (${formData.units.length})`}
      open={open}
      onToggle={onToggle}
      action={
        supportsUnits ? (
          <button
            type="button"
            aria-label="Add unit type"
            onClick={onAddUnit}
            className="flex size-8 items-center justify-center rounded-full bg-text-primary text-[var(--screen)]"
          >
            <FiPlus size={16} aria-hidden="true" />
          </button>
        ) : null
      }
    />
    {open && (
      <div className="flex flex-col gap-3">
        {formData.units.map((unit) => (
          <div key={unit.id} className="rounded-2xl border border-blue-text p-3">
            <div className="mb-3 text-caption-1 text-blue-text">Draft unit type</div>
            <RoomUnitFieldsEditor unit={unit} onUpdateUnit={onUpdateUnit} />
          </div>
        ))}
        {formData.units.length === 0 && supportsUnits && (
          <p className="px-1 text-body-4 text-text-secondary">
            Add unit types when this room contains kennels, wards, pods, or bays.
          </p>
        )}
        {!supportsUnits && (
          <p className="px-1 text-body-4 text-text-secondary">
            Select ICU, Inpatient, Isolation, or Boarding to configure unit types.
          </p>
        )}
      </div>
    )}
  </section>
);

export const EquipmentSection = ({
  customEquipmentName,
  formData,
  open,
  onAddCustomEquipment,
  onCustomEquipmentNameChange,
  onToggle,
  onChange,
}: {
  customEquipmentName: string;
  formData: RoomFormData;
  open: boolean;
  onAddCustomEquipment: () => void;
  onCustomEquipmentNameChange: (value: string) => void;
  onToggle: () => void;
  onChange: (patch: Partial<RoomFormData>) => void;
}) => {
  const equipmentOptions = Array.from(new Set([...RoomEquipmentOptions, ...formData.equipment]));

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Equipments / Capabilities" open={open} onToggle={onToggle} />
      {open && (
        <div className="flex flex-col gap-3">
          <MultiSelectDropdown
            placeholder="Equipment"
            value={formData.equipment}
            onChange={(value) => onChange({ equipment: value })}
            options={equipmentOptions}
          />
          <div className="flex items-end gap-2">
            <FormInput
              intype="text"
              value={customEquipmentName}
              inlabel="Add equipment name"
              onChange={(event) => onCustomEquipmentNameChange(event.target.value)}
            />
            <button
              type="button"
              aria-label="Add custom equipment"
              onClick={onAddCustomEquipment}
              className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-text-primary text-[var(--screen)]"
            >
              <FiPlus size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export type { OpenSections };
