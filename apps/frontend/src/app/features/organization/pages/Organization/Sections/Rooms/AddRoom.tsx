import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import React, { useMemo, useState } from 'react';
import { UnitCapableRoomTypes } from '@/app/features/organization/pages/Organization/types';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { OrganisationRoom, RoomReferenceMapping } from '@yosemite-crew/types';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { createRoom } from '@/app/features/organization/services/roomService';
import Close from '@/app/ui/primitives/Icons/Close';
import { useNotify } from '@/app/hooks/useNotify';
import { FiCheck } from 'react-icons/fi';
import {
  AvailabilitySection,
  BasicDetailsSection,
  EquipmentSection,
  OpenSections,
  UnitsSection,
} from './AddRoomSections';

type AddRoomProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

export type RoomUnitDraft = {
  id: string;
  name: string;
  size: string;
  count: number;
  occupied?: boolean;
};

export type RoomFormData = Omit<
  OrganisationRoom,
  'assignedSpecialiteis' | 'assignedStaffs' | 'type'
> & {
  code: string;
  type: OrganisationRoom['type'] | '';
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
  type: '',
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
  equipment: [],
};

const buildRoomId = () => `room-${Date.now()}`;

const getTotalUnits = (units: RoomUnitDraft[], fallback: number) =>
  units.length ? units.reduce((total, unit) => total + unit.count, 0) : fallback;

const distributeUnitCounts = (units: RoomUnitDraft[], totalUnits: number) => {
  if (!units.length) return units;

  const safeTotal = Math.max(0, Math.floor(totalUnits));
  const baseCount = Math.floor(safeTotal / units.length);
  let remainder = safeTotal % units.length;

  return units.map((unit) => {
    const nextCount = baseCount + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return {
      ...unit,
      count: nextCount,
    };
  });
};

const isUnitCapableRoomType = (type: OrganisationRoom['type'] | '') =>
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

const AddRoom = ({ showModal, setShowModal }: AddRoomProps) => {
  const teams = useTeamForPrimaryOrg();
  const { notify } = useNotify();
  const specialities = useSpecialitiesForPrimaryOrg();
  const [formData, setFormData] = useState<RoomFormData>(INITIAL_FORM_DATA);
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    code?: string;
    type?: string;
  }>({});
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
      units:
        patch.totalUnits === undefined
          ? prev.units
          : distributeUnitCounts(prev.units, patch.totalUnits),
      unitCount:
        patch.totalUnits === undefined ? prev.unitCount : Math.max(0, Math.floor(patch.totalUnits)),
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
      availability:
        patch.count === undefined
          ? prev.availability
          : {
              ...prev.availability,
              totalUnits: getTotalUnits(
                prev.units.map((unit) => (unit.id === id ? { ...unit, ...patch } : unit)),
                prev.availability.totalUnits
              ),
            },
      unitCount:
        patch.count === undefined
          ? prev.unitCount
          : getTotalUnits(
              prev.units.map((unit) => (unit.id === id ? { ...unit, ...patch } : unit)),
              prev.availability.totalUnits
            ),
    }));
  };

  const updateFormData = (patch: Partial<RoomFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  const toggleSection = (section: keyof OpenSections) => {
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
      unitCount: nextSupportsUnits ? prev.unitCount : 0,
      availability: {
        ...prev.availability,
        totalUnits: nextSupportsUnits ? prev.availability.totalUnits : 0,
      },
    }));
  };

  const handleSave = async () => {
    const errors: { name?: string; code?: string; type?: string } = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.type) errors.type = 'Room type is required';
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const roomType = formData.type as OrganisationRoom['type'];
    setSaving(true);
    try {
      const totalUnits = getTotalUnits(formData.units, formData.availability.totalUnits);
      const roomPayload: OrganisationRoom &
        Pick<RoomFormData, 'availability' | 'unitCount' | 'units' | 'equipment'> = {
        ...formData,
        type: roomType,
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
            <BasicDetailsSection
              formData={formData}
              formDataErrors={formDataErrors}
              open={openSections.details}
              specialitiesOptions={SpecialitiesOptions}
              onToggle={() => toggleSection('details')}
              onChange={updateFormData}
              onRoomTypeChange={handleRoomTypeChange}
            />
            <AvailabilitySection
              formData={formData}
              open={openSections.availability}
              supportsUnits={supportsUnits}
              teamOptions={TeamOptions}
              onToggle={() => toggleSection('availability')}
              onAvailabilityChange={updateAvailability}
              onChange={updateFormData}
            />
            <UnitsSection
              formData={formData}
              open={openSections.units}
              supportsUnits={supportsUnits}
              onAddUnit={addUnitDraft}
              onToggle={() => toggleSection('units')}
              onUpdateUnit={updateUnitDraft}
            />
            <EquipmentSection
              customEquipmentName={customEquipmentName}
              formData={formData}
              open={openSections.equipment}
              onAddCustomEquipment={addCustomEquipment}
              onCustomEquipmentNameChange={setCustomEquipmentName}
              onToggle={() => toggleSection('equipment')}
              onChange={updateFormData}
            />
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
