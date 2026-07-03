import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import Timepicker from '@/app/ui/inputs/Timepicker';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import Close from '@/app/ui/primitives/Icons/Close';
import { useNotify } from '@/app/hooks/useNotify';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  deleteRoom,
  toggleRoomAvailability,
  updateRoom,
} from '@/app/features/organization/services/roomService';
import {
  RoomDaysOptions,
  RoomEquipmentOptions,
  RoomSpeciesOptions,
  RoomsTypes,
  RoomUnitSizeOptions,
  UnitCapableRoomTypes,
} from '@/app/features/organization/pages/Organization/types';
import { OrganisationRoom, RoomReferenceMapping, RoomUnitGroup } from '@yosemite-crew/types';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import React, { useMemo, useRef, useState } from 'react';
import { FiCheck, FiChevronDown, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';

type RoomUnitDetails = {
  id: string;
  name: string;
  size: string;
  count: number;
  occupied?: boolean;
};

type ManagedRoom = Omit<OrganisationRoom, 'assignedSpecialiteis' | 'assignedStaffs'> & {
  code?: string;
  assignedSpecialiteis?: string[];
  assignedStaffs?: string[];
  availability?: {
    isAvailable?: boolean;
    days?: string;
    startTime?: string;
    endTime?: string;
    species?: string | string[];
    totalUnits?: number;
  };
  unitCount?: number;
  units?: RoomUnitDetails[];
  equipment?: string[];
  archived?: boolean;
};

type RoomFormInput = Omit<ManagedRoom, 'assignedSpecialiteis' | 'assignedStaffs'> & {
  assignedSpecialiteis?: RoomReferenceMapping[] | string[];
  assignedStaffs?: RoomReferenceMapping[] | string[];
};

type RoomInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeRoom: OrganisationRoom;
  canEditRoom: boolean;
};

const DEFAULT_AVAILABILITY = {
  isAvailable: true,
  days: 'MON_SAT',
  startTime: '10:00',
  endTime: '20:00',
  species: ['CANINE'],
  totalUnits: 0,
};

const EMPTY_IDS: string[] = [];

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      message?: string;
      response?: {
        data?: {
          message?: string;
        };
      };
    };

    return maybeError.response?.data?.message ?? maybeError.message ?? fallback;
  }

  return fallback;
};

const getOptionLabel = (options: { label: string; value: string }[], value?: string) =>
  options.find((option) => option.value === value)?.label ?? value ?? '-';

const getOptionLabels = (options: { label: string; value: string }[], values?: string[]) => {
  if (!values?.length) return '-';
  return values.map((value) => getOptionLabel(options, value)).join(', ');
};

const normalizeSpeciesValues = (value?: string | string[]) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return [value];
};

const isUnitCapableRoomType = (type?: OrganisationRoom['type']) =>
  Boolean(type && UnitCapableRoomTypes.includes(type as (typeof UnitCapableRoomTypes)[number]));

const normalizeReferenceIds = (values?: RoomReferenceMapping[] | string[]) =>
  (values ?? [])
    .map((value) => (typeof value === 'string' ? value : value.id))
    .filter((value): value is string => Boolean(value));

const toOptionMap = (options: { label: string; value: string }[]) =>
  Object.fromEntries(options.map((option) => [option.value, option.label]));

const toReferenceMappings = (
  ids: string[] | undefined,
  byId: Record<string, string>
): RoomReferenceMapping[] =>
  (ids ?? [])
    .map((id) => {
      const name = byId[id];
      return name ? { id, name } : undefined;
    })
    .filter((entry): entry is RoomReferenceMapping => Boolean(entry));

const getUnitCount = (unit: Partial<RoomUnitDetails>) => {
  const count = Number(unit.count ?? 1);
  return Number.isFinite(count) ? count : 1;
};

const sumUnitCounts = (units: Array<Partial<RoomUnitDetails>> | undefined) =>
  units?.reduce((total, unit) => total + getUnitCount(unit), 0) ?? 0;

const distributeUnitCounts = (units: RoomUnitDetails[] | undefined, totalUnits: number) => {
  if (!units?.length) return units ?? [];

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

const uniqueValues = (values: Array<string | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const getRoomForm = (room: RoomFormInput, unitGroups: RoomUnitGroup[] = []): ManagedRoom => ({
  ...room,
  code: room.code ?? room.id ?? '',
  assignedSpecialiteis: normalizeReferenceIds(room.assignedSpecialiteis),
  assignedStaffs: normalizeReferenceIds(room.assignedStaffs),
  availability: {
    ...DEFAULT_AVAILABILITY,
    ...room.availability,
    isAvailable:
      room.availableNow ?? room.availability?.isAvailable ?? DEFAULT_AVAILABILITY.isAvailable,
    days: room.availabilityDays?.[0] ?? room.availability?.days ?? DEFAULT_AVAILABILITY.days,
    startTime:
      room.availabilityStartTime ?? room.availability?.startTime ?? DEFAULT_AVAILABILITY.startTime,
    endTime: room.availabilityEndTime ?? room.availability?.endTime ?? DEFAULT_AVAILABILITY.endTime,
    species: normalizeSpeciesValues(
      room.availability?.species ??
        uniqueValues(unitGroups.flatMap((group) => group.speciesConstraints ?? [])) ??
        DEFAULT_AVAILABILITY.species
    ),
    totalUnits:
      room.availability?.totalUnits ??
      room.unitCount ??
      (room.units
        ? sumUnitCounts(room.units)
        : unitGroups.reduce((total, group) => total + group.unitCount, 0)),
  },
  units:
    room.units?.map((unit, index) => ({
      id: unit.id || `unit-${index + 1}`,
      name: unit.name || `${index + 1}`,
      size: unit.size || 'Medium',
      count: getUnitCount(unit),
      occupied: unit.occupied ?? false,
    })) ??
    unitGroups.map((group, index) => ({
      id: group.id || `unit-${index + 1}`,
      name: group.name || `${index + 1}`,
      size: group.size || 'Medium',
      count: group.unitCount,
      occupied: false,
    })),
  unitCount:
    room.unitCount ??
    (room.units
      ? sumUnitCounts(room.units)
      : unitGroups.reduce((total, group) => total + group.unitCount, 0)),
  equipment: room.equipment ??
    room.capabilities ??
    uniqueValues(unitGroups.flatMap((group) => group.capabilities ?? [])) ?? [
      'Oxygen Tank',
      'Dental Unit',
      'Isolation unit',
    ],
});

const getTotalUnits = (room: ManagedRoom) =>
  room.units?.length
    ? sumUnitCounts(room.units)
    : (room.availability?.totalUnits ?? room.unitCount ?? 0);

const getRoomStateKey = (room: OrganisationRoom, showModal: boolean, unitGroups: RoomUnitGroup[]) =>
  `${showModal ? 'open' : 'closed'}:${room.id || room.name}:${unitGroups
    .map((group) => `${group.id}:${group.unitCount}`)
    .join('|')}`;

const SectionHeader = ({
  title,
  open,
  onToggle,
  meta,
  action,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-w-0 items-center gap-3 text-left text-body-3-emphasis text-text-primary"
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
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="inline-flex h-6 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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

const DetailRows = ({
  rows,
  bordered = false,
}: {
  rows: Array<{ label: string; value: React.ReactNode }>;
  bordered?: boolean;
}) => {
  const content = (
    <dl className="grid grid-cols-[1fr_1.2fr] gap-x-4 gap-y-2 text-body-4">
      {rows.map((row) => (
        <React.Fragment key={row.label}>
          <dt className="text-text-secondary">{row.label}</dt>
          <dd className="text-right text-text-primary">{row.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );

  if (!bordered) return content;

  return <div className="rounded-2xl border border-card-border p-4">{content}</div>;
};

const IconCircleButton = ({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`flex h-8 w-8 items-center justify-center rounded-full border ${
      danger
        ? 'border-text-error bg-white text-text-error'
        : 'border-text-primary bg-text-primary text-white'
    }`}
  >
    {children}
  </button>
);

const RoomInfo = ({ showModal, setShowModal, activeRoom, canEditRoom }: RoomInfoProps) => {
  const { notify } = useNotify();
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();
  const roomUnitGroupsById = useOrganisationRoomStore((state) => state.roomUnitGroupsById);
  const roomUnitGroupIds = useOrganisationRoomStore(
    (state) =>
      (activeRoom.id ? state.roomUnitGroupIdsByRoomId[activeRoom.id] : undefined) ?? EMPTY_IDS
  );
  const roomUnitGroups = useMemo(
    () =>
      roomUnitGroupIds
        .map((id) => roomUnitGroupsById[id])
        .filter((group): group is RoomUnitGroup => group != null),
    [roomUnitGroupIds, roomUnitGroupsById]
  );
  const roomStateKey = getRoomStateKey(activeRoom, showModal, roomUnitGroups);
  const syncedRoomStateKeyRef = useRef(roomStateKey);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [formData, setFormData] = useState<ManagedRoom>(() =>
    getRoomForm(activeRoom, roomUnitGroups)
  );
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [customEquipmentName, setCustomEquipmentName] = useState('');
  const [openSections, setOpenSections] = useState({
    details: true,
    availability: true,
    units: true,
    equipment: true,
  });

  if (syncedRoomStateKeyRef.current !== roomStateKey) {
    syncedRoomStateKeyRef.current = roomStateKey;
    setMode('view');
    setFormData(getRoomForm(activeRoom, roomUnitGroups));
    setCustomEquipmentName('');
  }

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

  const staffNameById = useMemo(() => toOptionMap(TeamOptions), [TeamOptions]);

  const specialityNameById = useMemo(() => toOptionMap(SpecialitiesOptions), [SpecialitiesOptions]);

  const equipmentOptions = useMemo(
    () => Array.from(new Set([...RoomEquipmentOptions, ...(formData.equipment ?? [])])),
    [formData.equipment]
  );
  const supportsUnits = isUnitCapableRoomType(formData.type);

  const isDirty =
    JSON.stringify(formData) !== JSON.stringify(getRoomForm(activeRoom, roomUnitGroups)) ||
    customEquipmentName.trim().length > 0;
  const totalUnits = getTotalUnits(formData);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateAvailability = (patch: Partial<NonNullable<ManagedRoom['availability']>>) => {
    const nextTotalUnits = patch.totalUnits ?? formData.availability?.totalUnits ?? 0;
    setFormData((prev) => ({
      ...prev,
      availability: {
        ...(prev.availability ?? DEFAULT_AVAILABILITY),
        ...patch,
        totalUnits:
          patch.totalUnits === undefined
            ? (prev.availability?.totalUnits ?? 0)
            : Math.max(0, Math.floor(patch.totalUnits)),
      },
      units:
        patch.totalUnits === undefined
          ? prev.units
          : distributeUnitCounts(prev.units, nextTotalUnits),
      unitCount:
        patch.totalUnits === undefined ? prev.unitCount : Math.max(0, Math.floor(nextTotalUnits)),
    }));
  };

  const closeDrawer = () => {
    if (mode === 'edit' && isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    setShowModal(false);
  };

  const discardChanges = () => {
    setFormData(getRoomForm(activeRoom, roomUnitGroups));
    setMode('view');
    setCustomEquipmentName('');
    setShowDiscardConfirm(false);
  };

  const addUnitDraft = () => {
    if (!supportsUnits) return;

    setFormData((prev) => ({
      ...prev,
      units: [
        ...(prev.units ?? []),
        {
          id: `unit-${(prev.units ?? []).length + 1}`,
          name: '',
          size: 'Medium',
          count: 1,
          occupied: false,
        },
      ],
    }));
  };

  const updateUnit = (id: string, patch: Partial<RoomUnitDetails>) => {
    setFormData((prev) => {
      const nextUnits = (prev.units ?? []).map((unit) =>
        unit.id === id ? { ...unit, ...patch } : unit
      );
      const nextTotalUnits = sumUnitCounts(nextUnits);

      return {
        ...prev,
        units: nextUnits,
        availability: {
          ...(prev.availability ?? DEFAULT_AVAILABILITY),
          totalUnits: nextTotalUnits,
        },
        unitCount: nextTotalUnits,
      };
    });
  };

  const addCustomEquipment = () => {
    const name = customEquipmentName.trim();
    if (!name) return;
    setFormData((prev) => {
      const equipment = prev.equipment ?? [];
      return {
        ...prev,
        equipment: equipment.includes(name) ? equipment : [...equipment, name],
      };
    });
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
        ...(prev.availability ?? DEFAULT_AVAILABILITY),
        totalUnits: nextSupportsUnits ? (prev.availability?.totalUnits ?? 0) : 0,
      },
    }));
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const payload: OrganisationRoom &
        Pick<ManagedRoom, 'availability' | 'unitCount' | 'units' | 'equipment'> = {
        ...formData,
        unitCount: totalUnits,
        availability: {
          ...(formData.availability ?? DEFAULT_AVAILABILITY),
          totalUnits,
        },
        units: supportsUnits ? (formData.units ?? []) : [],
        assignedSpecialiteis: toReferenceMappings(
          formData.assignedSpecialiteis,
          specialityNameById
        ),
        assignedStaffs: toReferenceMappings(formData.assignedStaffs, staffNameById),
        availableNow: formData.availability?.isAvailable ?? true,
        availabilityMode: 'CUSTOM',
        availabilityDays: formData.availability?.days ? [formData.availability.days] : undefined,
        availabilityStartTime: formData.availability?.startTime,
        availabilityEndTime: formData.availability?.endTime,
        capabilities: formData.equipment,
      };
      await updateRoom(payload);
      notify('success', {
        title: 'Room updated',
        text: 'Room details have been updated successfully.',
      });
      setMode('view');
    } catch (error) {
      notify('error', {
        title: 'Unable to update room',
        text: getErrorMessage(error, 'Failed to update room. Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvailabilityToggle = async (checked: boolean) => {
    if (mode === 'edit') {
      updateAvailability({ isAvailable: checked });
      return;
    }

    try {
      await toggleRoomAvailability(activeRoom, checked);
      updateAvailability({ isAvailable: checked });
      notify('success', {
        title: checked ? 'Room available' : 'Room unavailable',
        text: `${activeRoom.name} availability has been updated.`,
      });
    } catch (error) {
      notify('error', {
        title: 'Unable to update room',
        text: getErrorMessage(error, 'Failed to update room availability. Please try again.'),
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRoom(activeRoom);
      notify('success', {
        title: 'Room deleted',
        text: 'Room has been deleted successfully.',
      });
      setShowDeleteModal(false);
      setShowModal(false);
    } catch (error) {
      notify('error', {
        title: 'Unable to delete room',
        text: getErrorMessage(error, 'Failed to delete room. Please try again.'),
      });
    }
  };

  const specialityLabel =
    (formData.assignedSpecialiteis ?? [])
      .flatMap((id) => {
        const name = specialityNameById[id] ?? id;
        return name ? [name] : [];
      })
      .join(', ') || '-';
  const staffLabel =
    (formData.assignedStaffs ?? [])
      .flatMap((id) => {
        const name = staffNameById[id] ?? id;
        return name ? [name] : [];
      })
      .join('\n') || '-';
  const equipmentLabel = formData.equipment?.join(', ') || '-';

  return (
    <>
      <Modal
        showModal={showModal}
        setShowModal={setShowModal}
        canClose={() => {
          if (mode === 'edit' && isDirty) {
            setShowDiscardConfirm(true);
            return false;
          }
          return true;
        }}
      >
        <div className="flex h-full flex-col gap-5">
          <div className="flex items-center justify-between border-b border-card-border pb-4">
            <h2 className="text-body-1 text-text-primary">
              {mode === 'edit' ? 'Edit room' : formData.name}
            </h2>
            <div className="flex items-center gap-3">
              {canEditRoom && mode === 'view' && (
                <IconCircleButton label="Edit room" onClick={() => setMode('edit')}>
                  <FiEdit2 size={15} aria-hidden="true" />
                </IconCircleButton>
              )}
              {canEditRoom && (
                <IconCircleButton
                  label="Delete room"
                  onClick={() => setShowDeleteModal(true)}
                  danger
                >
                  <FiTrash2 size={15} aria-hidden="true" />
                </IconCircleButton>
              )}
              <Close onClick={closeDrawer} />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1 scrollbar-hidden">
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Details"
                open={openSections.details}
                onToggle={() => toggleSection('details')}
              />
              {openSections.details && mode === 'view' && (
                <DetailRows
                  bordered
                  rows={[
                    { label: 'Name', value: formData.name || '-' },
                    { label: 'Room Code', value: formData.code || formData.id || '-' },
                    { label: 'Room type', value: getOptionLabel(RoomsTypes, formData.type) },
                    { label: 'Speciality', value: specialityLabel },
                  ]}
                />
              )}
              {openSections.details && mode === 'edit' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormInput
                    intype="text"
                    value={formData.name}
                    inlabel="Name"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <FormInput
                    intype="text"
                    value={formData.code ?? ''}
                    inlabel="Room code"
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                  <div className="sm:col-span-2">
                    <LabelDropdown
                      placeholder="Room Type"
                      options={RoomsTypes}
                      defaultOption={formData.type}
                      onSelect={(option) =>
                        handleRoomTypeChange(option.value as OrganisationRoom['type'])
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <MultiSelectDropdown
                      placeholder="Speciality (optional)"
                      value={formData.assignedSpecialiteis ?? []}
                      onChange={(value) =>
                        setFormData({ ...formData, assignedSpecialiteis: value })
                      }
                      options={SpecialitiesOptions}
                    />
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
                    checked={formData.availability?.isAvailable ?? true}
                    disabled={!canEditRoom}
                    label="Toggle room availability"
                    onChange={(checked) => void handleAvailabilityToggle(checked)}
                  />
                }
              />
              {openSections.availability && mode === 'view' && (
                <DetailRows
                  bordered
                  rows={[
                    {
                      label: 'Days',
                      value: getOptionLabel(RoomDaysOptions, formData.availability?.days),
                    },
                    {
                      label: 'Time',
                      value: `${formData.availability?.startTime ?? '-'} - ${formData.availability?.endTime ?? '-'}`,
                    },
                    {
                      label: 'Species',
                      value: getOptionLabels(
                        RoomSpeciesOptions,
                        normalizeSpeciesValues(formData.availability?.species)
                      ),
                    },
                    { label: 'Total units', value: totalUnits },
                    {
                      label: 'Assigned staff',
                      value: <span className="whitespace-pre-line">{staffLabel}</span>,
                    },
                  ]}
                />
              )}
              {openSections.availability && mode === 'edit' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <LabelDropdown
                    placeholder="Days"
                    options={RoomDaysOptions}
                    defaultOption={formData.availability?.days}
                    onSelect={(option) => updateAvailability({ days: option.value })}
                  />
                  <Timepicker
                    label="Start time"
                    value={formData.availability?.startTime ?? ''}
                    onChange={(value) => updateAvailability({ startTime: value })}
                  />
                  <Timepicker
                    label="End time"
                    value={formData.availability?.endTime ?? ''}
                    onChange={(value) => updateAvailability({ endTime: value })}
                  />
                  <MultiSelectDropdown
                    placeholder="Species"
                    value={normalizeSpeciesValues(formData.availability?.species)}
                    onChange={(value) => updateAvailability({ species: value })}
                    options={RoomSpeciesOptions}
                  />
                  {supportsUnits && (
                    <FormInput
                      intype="number"
                      value={String(formData.availability?.totalUnits ?? 0)}
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
                      value={formData.assignedStaffs ?? []}
                      onChange={(value) => setFormData({ ...formData, assignedStaffs: value })}
                      options={TeamOptions}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeader
                title={`Unit type (${formData.units?.length ?? 0})`}
                open={openSections.units}
                onToggle={() => toggleSection('units')}
                action={
                  mode === 'edit' && supportsUnits ? (
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
                  {(formData.units ?? []).map((unit) =>
                    mode === 'view' ? (
                      <fieldset key={unit.id} className="rounded-2xl border border-card-border p-4">
                        <legend className="px-2 text-caption-1 text-text-primary">
                          {unit.name || 'Unit type'}
                        </legend>
                        <DetailRows
                          rows={[
                            { label: 'Name', value: unit.name || '-' },
                            { label: 'Size', value: unit.size || '-' },
                            { label: 'Unit', value: unit.count },
                          ]}
                        />
                      </fieldset>
                    ) : (
                      <div key={unit.id} className="rounded-2xl border border-blue-text p-3">
                        <div className="grid grid-cols-1 gap-3">
                          <FormInput
                            intype="text"
                            value={unit.name}
                            inlabel="Name"
                            onChange={(e) => updateUnit(unit.id, { name: e.target.value })}
                          />
                          <LabelDropdown
                            placeholder="Size"
                            options={RoomUnitSizeOptions}
                            defaultOption={unit.size}
                            onSelect={(option) => updateUnit(unit.id, { size: option.value })}
                          />
                          <FormInput
                            intype="number"
                            value={String(unit.count)}
                            inlabel="Units"
                            onChange={(e) => {
                              const parsed = Number(e.target.value);
                              updateUnit(unit.id, {
                                count: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                              });
                            }}
                          />
                        </div>
                      </div>
                    )
                  )}
                  {(formData.units ?? []).length === 0 && supportsUnits && (
                    <p className="px-1 text-body-4 text-text-secondary">
                      No unit types configured.
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
              {openSections.equipment && mode === 'view' && (
                <p className="px-1 text-body-4 text-text-primary">{equipmentLabel}</p>
              )}
              {openSections.equipment && mode === 'edit' && (
                <div className="flex flex-col gap-3">
                  <MultiSelectDropdown
                    placeholder="Equipment"
                    value={formData.equipment ?? []}
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
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-text-primary text-white"
                    >
                      <FiPlus size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {mode === 'edit' && (
            <div className="flex justify-between gap-3 border-t border-card-border pt-4">
              <Secondary href="#" text="Discard" onClick={discardChanges} />
              <Primary
                href="#"
                text={saving ? 'Saving...' : 'Save'}
                onClick={handleUpdate}
                icon={<FiCheck size={16} aria-hidden="true" />}
              />
            </div>
          )}
        </div>
      </Modal>

      <CenterModal showModal={showDiscardConfirm} setShowModal={setShowDiscardConfirm}>
        <ModalHeader title="Discard changes?" onClose={() => setShowDiscardConfirm(false)} />
        <p className="text-body-4 text-text-primary">
          You have unsaved room changes. Are you sure you want to discard them?
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Secondary href="#" text="Keep editing" onClick={() => setShowDiscardConfirm(false)} />
          <Primary href="#" text="Discard" onClick={discardChanges} />
        </div>
      </CenterModal>

      <CenterModal showModal={showDeleteModal} setShowModal={setShowDeleteModal}>
        <ModalHeader title="Delete room?" onClose={() => setShowDeleteModal(false)} />
        <p className="text-body-4 text-text-primary">
          Are you sure you want to delete <strong>{activeRoom.name}</strong>? This action cannot be
          undone.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Secondary href="#" text="Cancel" onClick={() => setShowDeleteModal(false)} />
          <Delete href="#" text="Delete" onClick={handleDelete} />
        </div>
      </CenterModal>
    </>
  );
};

export default RoomInfo;
