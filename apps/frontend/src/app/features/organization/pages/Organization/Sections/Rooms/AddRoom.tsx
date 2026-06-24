import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import React, { useMemo, useState } from 'react';
import {
  RoomDaysOptions,
  RoomEquipmentOptions,
  RoomSpeciesOptions,
  RoomsTypes,
  RoomUnitSizeOptions,
  UnitCapableRoomTypes,
} from '@/app/features/organization/pages/Organization/types';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import { OrganisationRoom, RoomReferenceMapping } from '@yosemite-crew/types';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { createRoom } from '@/app/features/organization/services/roomService';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import Close from '@/app/ui/primitives/Icons/Close';
import Timepicker from '@/app/ui/inputs/Timepicker';
import { useNotify } from '@/app/hooks/useNotify';
import { FiCheck, FiChevronDown, FiPlus } from 'react-icons/fi';

type AddRoomProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

type RoomUnitDraft = {
  id: string;
  name: string;
  size: string;
  count: number;
  occupied?: boolean;
};

type RoomFormData = Omit<OrganisationRoom, 'assignedSpecialiteis' | 'assignedStaffs'> & {
  code: string;
  assignedSpecialiteis: string[];
  assignedStaffs: string[];
  availability: {
    isAvailable: boolean;
    days: string;
    startTime: string;
    endTime: string;
    species: string[];
    totalUnits: number;
  };
  units: RoomUnitDraft[];
  unitCount: number;
  equipment: string[];
  archived?: boolean;
};

const INITIAL_FORM_DATA: RoomFormData = {
  id: '',
  organisationId: '',
  name: '',
  code: '',
  type: 'SURGERY',
  assignedSpecialiteis: [],
  assignedStaffs: [],
  availability: {
    isAvailable: true,
    days: 'MON_SAT',
    startTime: '10:00',
    endTime: '20:00',
    species: [],
    totalUnits: 0,
  },
  units: [],
  unitCount: 0,
  equipment: ['Oxygen Tank', 'Dental Unit', 'Isolation unit'],
};

const buildRoomId = () => `room-${Date.now()}`;

const getTotalUnits = (units: RoomUnitDraft[], fallback: number) =>
  units.length ? units.reduce((total, unit) => total + unit.count, 0) : fallback;

const isUnitCapableRoomType = (type: OrganisationRoom['type']) =>
  UnitCapableRoomTypes.includes(type as (typeof UnitCapableRoomTypes)[number]);

const toOptionMap = (options: { label: string; value: string }[]) =>
  Object.fromEntries(options.map((option) => [option.value, option.label]));

const toReferenceMappings = (ids: string[], byId: Record<string, string>): RoomReferenceMapping[] =>
  ids
    .map((id) => {
      const name = byId[id];
      return name ? { id, name } : undefined;
    })
    .filter((entry): entry is RoomReferenceMapping => Boolean(entry));

const SectionHeader = ({
  title,
  meta,
  open,
  onToggle,
  action,
}: {
  title: string;
  meta?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3">
    <button
      type="button"
      onClick={onToggle}
      className="flex min-w-0 items-center gap-3 text-left text-body-3-emphasis text-text-primary"
      aria-expanded={open}
    >
      <FiChevronDown
        size={18}
        aria-hidden="true"
        className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
      />
      <span>{title}</span>
    </button>
    <div className="flex shrink-0 items-center gap-3">
      {meta}
      {action}
    </div>
  </div>
);

const ToggleSwitch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className="inline-flex h-6 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    style={{
      backgroundColor: checked ? 'var(--color-success-bright)' : 'var(--color-neutral-300)',
    }}
  >
    <span
      aria-hidden="true"
      className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-0'
      }`}
    />
  </button>
);

const AddRoom = ({ showModal, setShowModal }: AddRoomProps) => {
  const teams = useTeamForPrimaryOrg();
  const { notify } = useNotify();
  const specialities = useSpecialitiesForPrimaryOrg();
  const [formData, setFormData] = useState<RoomFormData>(INITIAL_FORM_DATA);
  const [formDataErrors, setFormDataErrors] = useState<{ name?: string; code?: string }>({});
  const [saving, setSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [customEquipmentName, setCustomEquipmentName] = useState('');
  const [openSections, setOpenSections] = useState({
    details: true,
    availability: true,
    units: true,
    equipment: true,
  });

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId,
        value: team.practionerId,
      })) ?? [],
    [teams]
  );

  const SpecialitiesOptions = useMemo(
    () =>
      specialities?.map((speciality) => ({
        label: speciality.name,
        value: speciality._id || speciality.name,
      })) ?? [],
    [specialities]
  );

  const equipmentOptions = useMemo(
    () => Array.from(new Set([...RoomEquipmentOptions, ...formData.equipment])),
    [formData.equipment]
  );
  const specialitiesById = useMemo(() => toOptionMap(SpecialitiesOptions), [SpecialitiesOptions]);
  const teamsById = useMemo(() => toOptionMap(TeamOptions), [TeamOptions]);
  const supportsUnits = isUnitCapableRoomType(formData.type);

  const isDirty =
    JSON.stringify(formData) !== JSON.stringify(INITIAL_FORM_DATA) ||
    customEquipmentName.trim().length > 0;

  const resetAndClose = () => {
    setFormData(INITIAL_FORM_DATA);
    setFormDataErrors({});
    setCustomEquipmentName('');
    setShowDiscardConfirm(false);
    setShowModal(false);
  };

  const requestClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    resetAndClose();
  };

  const updateAvailability = (patch: Partial<RoomFormData['availability']>) => {
    setFormData((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        ...patch,
      },
    }));
  };

  const addUnitDraft = () => {
    if (!supportsUnits) return;

    setFormData((prev) => ({
      ...prev,
      units: [
        ...prev.units,
        {
          id: `unit-${prev.units.length + 1}`,
          name: '',
          size: 'Medium',
          count: 1,
          occupied: false,
        },
      ],
    }));
  };

  const updateUnitDraft = (id: string, patch: Partial<RoomUnitDraft>) => {
    setFormData((prev) => ({
      ...prev,
      units: prev.units.map((unit) => (unit.id === id ? { ...unit, ...patch } : unit)),
    }));
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const addCustomEquipment = () => {
    const name = customEquipmentName.trim();
    if (!name) return;
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(name) ? prev.equipment : [...prev.equipment, name],
    }));
    setCustomEquipmentName('');
  };

  const handleRoomTypeChange = (type: OrganisationRoom['type']) => {
    const nextSupportsUnits = isUnitCapableRoomType(type);
    setFormData((prev) => ({
      ...prev,
      type,
      units: nextSupportsUnits ? prev.units : [],
      availability: {
        ...prev.availability,
        totalUnits: nextSupportsUnits ? prev.availability.totalUnits : 0,
      },
    }));
  };

  const handleSave = async () => {
    const errors: { name?: string; code?: string } = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const totalUnits = getTotalUnits(formData.units, formData.availability.totalUnits);
      const roomPayload: OrganisationRoom &
        Pick<RoomFormData, 'availability' | 'unitCount' | 'units' | 'equipment'> = {
        ...formData,
        id: formData.id || buildRoomId(),
        unitCount: totalUnits,
        availability: {
          ...formData.availability,
          totalUnits,
        },
        units: supportsUnits ? formData.units : [],
        assignedSpecialiteis: toReferenceMappings(formData.assignedSpecialiteis, specialitiesById),
        assignedStaffs: toReferenceMappings(formData.assignedStaffs, teamsById),
        availableNow: formData.availability.isAvailable,
        availabilityMode: 'CUSTOM',
        availabilityDays: [formData.availability.days],
        availabilityStartTime: formData.availability.startTime,
        availabilityEndTime: formData.availability.endTime,
        capabilities: formData.equipment,
      };
      await createRoom(roomPayload);
      notify('success', {
        title: 'Room created',
        text: 'Room has been created successfully.',
      });
      resetAndClose();
    } catch {
      notify('error', {
        title: 'Unable to create room',
        text: 'Failed to create room. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        showModal={showModal}
        setShowModal={setShowModal}
        canClose={() => {
          if (isDirty) {
            setShowDiscardConfirm(true);
            return false;
          }
          return true;
        }}
      >
        <div className="flex h-full flex-col gap-5">
          <div className="flex items-center justify-between border-b border-card-border pb-4">
            <h2 className="text-body-1 text-text-primary">Adding new room</h2>
            <Close onClick={requestClose} />
          </div>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1 scrollbar-hidden">
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Basic details"
                open={openSections.details}
                onToggle={() => toggleSection('details')}
              />
              {openSections.details && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormInput
                    intype="text"
                    inname="name"
                    value={formData.name}
                    inlabel="Name"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    error={formDataErrors.name}
                  />
                  <FormInput
                    intype="text"
                    inname="code"
                    value={formData.code}
                    inlabel="Room code"
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    error={formDataErrors.code}
                  />
                  <div className="sm:col-span-2">
                    <LabelDropdown
                      placeholder="Room Type"
                      onSelect={(option) =>
                        handleRoomTypeChange(option.value as OrganisationRoom['type'])
                      }
                      defaultOption={formData.type}
                      options={RoomsTypes}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <MultiSelectDropdown
                      placeholder="Speciality (optional)"
                      value={formData.assignedSpecialiteis || []}
                      onChange={(value) =>
                        setFormData({ ...formData, assignedSpecialiteis: value })
                      }
                      options={SpecialitiesOptions}
                    />
                  </div>
                  <div className="sm:col-span-2 rounded-2xl border border-orange-400 px-3 py-2 text-caption-1 text-orange-600">
                    Assign a specialty if this room is dedicated to a specific speciality or
                    service.
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Availability"
                open={openSections.availability}
                onToggle={() => toggleSection('availability')}
                meta={<span className="text-body-4 text-text-primary">Available now</span>}
                action={
                  <ToggleSwitch
                    checked={formData.availability.isAvailable}
                    label="Toggle room availability"
                    onChange={(checked) => updateAvailability({ isAvailable: checked })}
                  />
                }
              />
              {openSections.availability && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Timepicker
                    label="Start time"
                    name="startTime"
                    value={formData.availability.startTime}
                    onChange={(value) => updateAvailability({ startTime: value })}
                  />
                  <Timepicker
                    label="End time"
                    name="endTime"
                    value={formData.availability.endTime}
                    onChange={(value) => updateAvailability({ endTime: value })}
                  />
                  <LabelDropdown
                    placeholder="Days"
                    options={RoomDaysOptions}
                    defaultOption={formData.availability.days}
                    onSelect={(option) => updateAvailability({ days: option.value })}
                  />
                  <MultiSelectDropdown
                    placeholder="Species"
                    value={formData.availability.species}
                    onChange={(value) => updateAvailability({ species: value })}
                    options={RoomSpeciesOptions}
                  />
                  {supportsUnits && (
                    <FormInput
                      intype="number"
                      inname="totalUnits"
                      value={String(formData.availability.totalUnits)}
                      inlabel="Total Units"
                      onChange={(e) => {
                        const parsed = Number(e.target.value);
                        updateAvailability({
                          totalUnits: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                        });
                      }}
                    />
                  )}
                  {!supportsUnits && (
                    <p className="sm:col-span-2 rounded-2xl border border-card-border px-3 py-2 text-caption-1 text-text-secondary">
                      Units are available for ICU, Inpatient, Isolation, and Boarding rooms.
                    </p>
                  )}
                  <div className="sm:col-span-2">
                    <MultiSelectDropdown
                      placeholder="Assigned Staff (optional)"
                      value={formData.assignedStaffs || []}
                      onChange={(value) => setFormData({ ...formData, assignedStaffs: value })}
                      options={TeamOptions}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeader
                title={`Unit type (${formData.units.length})`}
                open={openSections.units}
                onToggle={() => toggleSection('units')}
                action={
                  supportsUnits ? (
                    <button
                      type="button"
                      aria-label="Add unit type"
                      onClick={addUnitDraft}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-text-primary text-white"
                    >
                      <FiPlus size={16} aria-hidden="true" />
                    </button>
                  ) : null
                }
              />
              {openSections.units && (
                <div className="flex flex-col gap-3">
                  {formData.units.map((unit) => (
                    <div key={unit.id} className="rounded-2xl border border-blue-text p-3">
                      <div className="mb-3 text-caption-1 text-blue-text">Draft unit type</div>
                      <div className="grid grid-cols-1 gap-3">
                        <FormInput
                          intype="text"
                          value={unit.name}
                          inlabel="Name"
                          onChange={(e) => updateUnitDraft(unit.id, { name: e.target.value })}
                        />
                        <LabelDropdown
                          placeholder="Size"
                          options={RoomUnitSizeOptions}
                          defaultOption={unit.size}
                          onSelect={(option) => updateUnitDraft(unit.id, { size: option.value })}
                        />
                        <FormInput
                          intype="number"
                          value={String(unit.count)}
                          inlabel="Units"
                          onChange={(e) => {
                            const parsed = Number(e.target.value);
                            updateUnitDraft(unit.id, {
                              count: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                            });
                          }}
                        />
                      </div>
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

            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Equipments / Capabilities"
                open={openSections.equipment}
                onToggle={() => toggleSection('equipment')}
              />
              {openSections.equipment && (
                <div className="flex flex-col gap-3">
                  <MultiSelectDropdown
                    placeholder="Equipment"
                    value={formData.equipment}
                    onChange={(value) => setFormData({ ...formData, equipment: value })}
                    options={equipmentOptions}
                  />
                  <div className="flex items-start gap-2">
                    <FormInput
                      intype="text"
                      value={customEquipmentName}
                      inlabel="Add equipment name"
                      onChange={(e) => setCustomEquipmentName(e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label="Add custom equipment"
                      onClick={addCustomEquipment}
                      className="mt-0 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-text-primary text-white"
                    >
                      <FiPlus size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="flex justify-start border-t border-card-border pt-4">
            <Primary
              href="#"
              text={saving ? 'Adding room...' : 'Add room'}
              onClick={handleSave}
              icon={<FiCheck size={16} aria-hidden="true" />}
            />
          </div>
        </div>
      </Modal>

      <CenterModal showModal={showDiscardConfirm} setShowModal={setShowDiscardConfirm}>
        <ModalHeader title="Discard changes?" onClose={() => setShowDiscardConfirm(false)} />
        <p className="text-body-4 text-text-primary">
          You have unsaved room details. Are you sure you want to discard them?
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Secondary href="#" text="Keep editing" onClick={() => setShowDiscardConfirm(false)} />
          <Primary href="#" text="Discard" onClick={resetAndClose} />
        </div>
      </CenterModal>
    </>
  );
};

export default AddRoom;
