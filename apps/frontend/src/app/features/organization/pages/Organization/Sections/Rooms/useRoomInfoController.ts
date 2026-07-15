import { useMemo, useRef, useState } from 'react';
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
  RoomSpeciesOptions,
  RoomsTypes,
  UnitCapableRoomTypes,
} from '@/app/features/organization/pages/Organization/types';
import { OrganisationRoom, RoomReferenceMapping, RoomUnitGroup } from '@yosemite-crew/types';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { OpenSections } from './RoomInfoSections';
import type { ManagedRoom, RoomFormInput, RoomUnitDetails } from './RoomInfo.types';

type UseRoomInfoControllerParams = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeRoom: OrganisationRoom;
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

export const useRoomInfoController = ({
  showModal,
  setShowModal,
  activeRoom,
}: UseRoomInfoControllerParams) => {
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
  const [openSections, setOpenSections] = useState<OpenSections>({
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

  const teamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId,
        value: team.practionerId,
      })) ?? [],
    [teams]
  );

  const specialitiesOptions = useMemo(
    () =>
      specialities?.map((speciality) => ({
        label: speciality.name,
        value: speciality._id || speciality.name,
      })) ?? [],
    [specialities]
  );

  const staffNameById = useMemo(() => toOptionMap(teamOptions), [teamOptions]);
  const specialityNameById = useMemo(() => toOptionMap(specialitiesOptions), [specialitiesOptions]);
  const supportsUnits = isUnitCapableRoomType(formData.type);
  const isDirty =
    JSON.stringify(formData) !== JSON.stringify(getRoomForm(activeRoom, roomUnitGroups)) ||
    customEquipmentName.trim().length > 0;
  const totalUnits = getTotalUnits(formData);

  const updateFormData = (patch: Partial<ManagedRoom>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  const toggleSection = (section: keyof OpenSections) => {
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
  const availabilityLabels = {
    days: getOptionLabel(RoomDaysOptions, formData.availability?.days),
    time: `${formData.availability?.startTime ?? '-'} - ${formData.availability?.endTime ?? '-'}`,
    species: getOptionLabels(
      RoomSpeciesOptions,
      normalizeSpeciesValues(formData.availability?.species)
    ),
  };

  return {
    availabilityLabels,
    closeDrawer,
    customEquipmentName,
    discardChanges,
    equipmentLabel,
    formData,
    handleAvailabilityToggle,
    handleDelete,
    handleRoomTypeChange,
    handleUpdate,
    isDirty,
    mode,
    openSections,
    roomTypeLabel: getOptionLabel(RoomsTypes, formData.type),
    saving,
    setCustomEquipmentName,
    setMode,
    setShowDeleteModal,
    setShowDiscardConfirm,
    showDeleteModal,
    showDiscardConfirm,
    specialityLabel,
    staffLabel,
    supportsUnits,
    totalUnits,
    options: {
      equipment: formData.equipment ?? [],
      specialities: specialitiesOptions,
      team: teamOptions,
    },
    addCustomEquipment,
    addUnitDraft,
    toggleSection,
    updateAvailability,
    updateFormData,
    updateUnit,
  };
};
