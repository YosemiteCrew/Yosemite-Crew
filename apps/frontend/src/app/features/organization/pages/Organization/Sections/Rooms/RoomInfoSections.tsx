import { Fragment, type ReactNode } from 'react';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import Timepicker from '@/app/ui/inputs/Timepicker';
import {
  RoomDaysOptions,
  RoomEquipmentOptions,
  RoomSpeciesOptions,
  RoomsTypes,
} from '@/app/features/organization/pages/Organization/types';
import { OrganisationRoom } from '@yosemite-crew/types';
import { FiPlus } from 'react-icons/fi';
import type { ManagedRoom, RoomUnitDetails } from './RoomInfo.types';
import { SectionHeader, ToggleSwitch } from './roomSectionPrimitives';
import RoomUnitFieldsEditor from './RoomUnitFieldsEditor';

type SelectOption = { label: string; value: string };
type OpenSections = Record<'details' | 'availability' | 'units' | 'equipment', boolean>;
type Mode = 'view' | 'edit';

const DetailRows = ({
  rows,
  bordered = false,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
  bordered?: boolean;
}) => {
  const content = (
    <dl className="grid grid-cols-[1fr_1.2fr] gap-x-4 gap-y-2 text-body-4">
      {rows.map((row) => (
        <Fragment key={row.label}>
          <dt className="text-text-secondary">{row.label}</dt>
          <dd className="text-right text-text-primary">{row.value}</dd>
        </Fragment>
      ))}
    </dl>
  );

  if (!bordered) return content;

  return <div className="rounded-2xl border border-card-border p-4">{content}</div>;
};

type RoomInfoSectionsProps = {
  canEditRoom: boolean;
  customEquipmentName: string;
  equipmentLabel: string;
  formData: ManagedRoom;
  mode: Mode;
  openSections: OpenSections;
  roomTypeLabel: string;
  specialityLabel: string;
  staffLabel: string;
  supportsUnits: boolean;
  totalUnits: number;
  availabilityLabels: {
    days: string;
    species: string;
    time: string;
  };
  options: {
    equipment: string[];
    specialities: SelectOption[];
    team: SelectOption[];
  };
  onAddCustomEquipment: () => void;
  onAddUnit: () => void;
  onAvailabilityToggle: (checked: boolean) => void;
  onCustomEquipmentNameChange: (value: string) => void;
  onFormChange: (patch: Partial<ManagedRoom>) => void;
  onRoomTypeChange: (type: OrganisationRoom['type']) => void;
  onToggleSection: (section: keyof OpenSections) => void;
  onUpdateAvailability: (patch: Partial<NonNullable<ManagedRoom['availability']>>) => void;
  onUpdateUnit: (id: string, patch: Partial<RoomUnitDetails>) => void;
};

const getRoomSpeciesValue = (species: string | string[] | undefined): string[] => {
  if (Array.isArray(species)) return species;
  return species ? [species] : [];
};

/** Every fallback the sections render, resolved once so the JSX stays branch-free. */
const getRoomFieldValues = (formData: ManagedRoom) => {
  const availability = formData.availability;
  return {
    name: formData.name || '-',
    code: formData.code || formData.id || '-',
    codeInput: formData.code ?? '',
    specialities: formData.assignedSpecialiteis ?? [],
    isAvailable: availability?.isAvailable ?? true,
    days: availability?.days,
    startTime: availability?.startTime ?? '',
    endTime: availability?.endTime ?? '',
    species: getRoomSpeciesValue(availability?.species),
    totalUnitsInput: String(availability?.totalUnits ?? 0),
    assignedStaffs: formData.assignedStaffs ?? [],
    units: formData.units ?? [],
    equipment: formData.equipment ?? [],
  };
};

/** Which half of each collapsible section is on screen for the current mode. */
const getSectionVisibility = (openSections: OpenSections, mode: Mode) => ({
  detailsView: openSections.details && mode === 'view',
  detailsEdit: openSections.details && mode === 'edit',
  availabilityView: openSections.availability && mode === 'view',
  availabilityEdit: openSections.availability && mode === 'edit',
  equipmentView: openSections.equipment && mode === 'view',
  equipmentEdit: openSections.equipment && mode === 'edit',
});

const getUnitViewRows = (unit: RoomUnitDetails) => [
  { label: 'Name', value: unit.name || '-' },
  { label: 'Size', value: unit.size || '-' },
  { label: 'Unit', value: unit.count },
];

const RoomInfoSections = ({
  canEditRoom,
  customEquipmentName,
  equipmentLabel,
  formData,
  mode,
  openSections,
  roomTypeLabel,
  specialityLabel,
  staffLabel,
  supportsUnits,
  totalUnits,
  availabilityLabels,
  options,
  onAddCustomEquipment,
  onAddUnit,
  onAvailabilityToggle,
  onCustomEquipmentNameChange,
  onFormChange,
  onRoomTypeChange,
  onToggleSection,
  onUpdateAvailability,
  onUpdateUnit,
}: RoomInfoSectionsProps) => {
  const values = getRoomFieldValues(formData);
  const visible = getSectionVisibility(openSections, mode);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1 scrollbar-hidden">
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Details"
          open={openSections.details}
          onToggle={() => onToggleSection('details')}
        />
        {visible.detailsView && (
          <DetailRows
            bordered
            rows={[
              { label: 'Name', value: values.name },
              { label: 'Room Code', value: values.code },
              { label: 'Room type', value: roomTypeLabel },
              { label: 'Speciality', value: specialityLabel },
            ]}
          />
        )}
        {visible.detailsEdit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormInput
              intype="text"
              value={formData.name}
              inlabel="Name"
              onChange={(event) => onFormChange({ name: event.target.value })}
            />
            <FormInput
              intype="text"
              value={values.codeInput}
              inlabel="Room code"
              onChange={(event) => onFormChange({ code: event.target.value })}
            />
            <div className="sm:col-span-2">
              <LabelDropdown
                placeholder="Room type"
                options={RoomsTypes}
                defaultOption={formData.type}
                onSelect={(option) => onRoomTypeChange(option.value as OrganisationRoom['type'])}
              />
            </div>
            <div className="sm:col-span-2">
              <MultiSelectDropdown
                placeholder="Speciality (optional)"
                value={values.specialities}
                onChange={(value) => onFormChange({ assignedSpecialiteis: value })}
                options={options.specialities}
              />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Availability"
          open={openSections.availability}
          onToggle={() => onToggleSection('availability')}
          meta={<span className="text-body-4 text-text-primary">Available now</span>}
          action={
            <ToggleSwitch
              checked={values.isAvailable}
              disabled={!canEditRoom}
              label="Toggle room availability"
              onChange={onAvailabilityToggle}
            />
          }
        />
        {visible.availabilityView && (
          <DetailRows
            bordered
            rows={[
              { label: 'Days', value: availabilityLabels.days },
              { label: 'Time', value: availabilityLabels.time },
              { label: 'Species', value: availabilityLabels.species },
              { label: 'Total units', value: totalUnits },
              {
                label: 'Assigned staff',
                value: <span className="whitespace-pre-line">{staffLabel}</span>,
              },
            ]}
          />
        )}
        {visible.availabilityEdit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabelDropdown
              placeholder="Days"
              options={RoomDaysOptions}
              defaultOption={values.days}
              onSelect={(option) => onUpdateAvailability({ days: option.value })}
            />
            <Timepicker
              label="Start time"
              value={values.startTime}
              onChange={(value) => onUpdateAvailability({ startTime: value })}
            />
            <Timepicker
              label="End time"
              value={values.endTime}
              onChange={(value) => onUpdateAvailability({ endTime: value })}
            />
            <MultiSelectDropdown
              placeholder="Species"
              value={values.species}
              onChange={(value) => onUpdateAvailability({ species: value })}
              options={RoomSpeciesOptions}
            />
            {supportsUnits ? (
              <FormInput
                intype="number"
                value={values.totalUnitsInput}
                inlabel="Total units"
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  onUpdateAvailability({
                    totalUnits: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                  });
                }}
              />
            ) : (
              <p className="sm:col-span-2 rounded-2xl border border-card-border px-3 py-2 text-caption-1 text-text-secondary">
                Units are available for ICU, Inpatient, Isolation, and Boarding rooms.
              </p>
            )}
            <div className="sm:col-span-2">
              <MultiSelectDropdown
                placeholder="Assigned staff (optional)"
                value={values.assignedStaffs}
                onChange={(value) => onFormChange({ assignedStaffs: value })}
                options={options.team}
              />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title={`Unit type (${values.units.length})`}
          open={openSections.units}
          onToggle={() => onToggleSection('units')}
          action={
            mode === 'edit' && supportsUnits ? (
              <button
                type="button"
                aria-label="Add unit type"
                onClick={onAddUnit}
                className="flex size-8 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--screen)]"
              >
                <FiPlus size={16} aria-hidden="true" />
              </button>
            ) : null
          }
        />
        {openSections.units && (
          <div className="flex flex-col gap-3">
            {values.units.map((unit) =>
              mode === 'view' ? (
                <fieldset key={unit.id} className="rounded-2xl border border-card-border p-4">
                  <legend className="px-2 text-caption-1 text-text-primary">
                    {unit.name || 'Unit type'}
                  </legend>
                  <DetailRows rows={getUnitViewRows(unit)} />
                </fieldset>
              ) : (
                <div key={unit.id} className="rounded-2xl border border-[var(--blue)] p-3">
                  <RoomUnitFieldsEditor unit={unit} onUpdateUnit={onUpdateUnit} />
                </div>
              )
            )}
            {values.units.length === 0 && supportsUnits && (
              <p className="px-1 text-body-4 text-text-secondary">No unit types configured.</p>
            )}
            {!supportsUnits && (
              <p className="px-1 text-body-4 text-text-secondary">
                Select ICU, Inpatient, Isolation, or Boarding to configure unit types.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Equipments / Capabilities"
          open={openSections.equipment}
          onToggle={() => onToggleSection('equipment')}
        />
        {visible.equipmentView && (
          <p className="px-1 text-body-4 text-text-primary">{equipmentLabel}</p>
        )}
        {visible.equipmentEdit && (
          <div className="flex flex-col gap-3">
            <MultiSelectDropdown
              placeholder="Equipment"
              value={values.equipment}
              onChange={(value) => onFormChange({ equipment: value })}
              options={Array.from(new Set([...RoomEquipmentOptions, ...options.equipment]))}
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
                className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[var(--ink)] text-[var(--screen)]"
              >
                <FiPlus size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default RoomInfoSections;
export type { OpenSections };
