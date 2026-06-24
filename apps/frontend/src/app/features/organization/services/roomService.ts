import {
  fromFHIRRoomUnit,
  fromFHIRRoomUnitGroup,
  fromOrganisationRoomRequestDTO,
  OrganisationRoom,
  OrganisationRoomResponseDTO,
  RoomUnit,
  RoomUnitGroup,
  toFHIRRoomUnit,
  toFHIRRoomUnitGroup,
  toOrganisationRoomResponseDTO,
} from '@yosemite-crew/types';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { deleteData, getData, patchData, postData, putData } from '@/app/services/axios';
import { UnitCapableRoomTypes } from '@/app/features/organization/pages/Organization/types';

type RoomAvailabilityDraft = {
  species?: string | string[];
  totalUnits?: number;
};

export type RoomUnitGroupDraft = {
  id?: string;
  name?: string;
  size?: string;
  count?: number;
  speciesConstraints?: string[];
};

type RoomMutationPayload = OrganisationRoom & {
  availability?: RoomAvailabilityDraft;
  units?: RoomUnitGroupDraft[];
  equipment?: string[];
};

const UNIT_CAPABLE_ROOM_TYPES = new Set<OrganisationRoom['type']>(UnitCapableRoomTypes);
const SUPPORTED_ROOM_SPECIES = new Set(['CANINE', 'FELINE', 'EQUINE']);

const normalizeRoomCode = (value?: string) => value?.trim() ?? '';

const buildFallbackRoomCode = (name?: string) => {
  const upperName = name?.trim().toUpperCase() ?? '';
  let base = '';
  let lastWasDash = false;

  for (const char of upperName) {
    const isAlphanumeric = (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9');

    if (isAlphanumeric) {
      base += char;
      lastWasDash = false;
      continue;
    }

    if (!lastWasDash) {
      base += '-';
      lastWasDash = true;
    }
  }

  let start = 0;
  let end = base.length;
  while (start < end && base[start] === '-') start += 1;
  while (end > start && base[end - 1] === '-') end -= 1;
  base = base.slice(start, end).slice(0, 18);
  if (!base) base = 'ROOM';
  const suffix = Date.now().toString(36).slice(-5).toUpperCase();
  return `${base}-${suffix}`;
};

const toSpeciesConstraints = (value?: string | string[]) => {
  let values: string[] = [];
  if (Array.isArray(value)) values = value;
  else if (value) values = [value];
  const species = values
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => SUPPORTED_ROOM_SPECIES.has(entry));
  return species.length ? Array.from(new Set(species)) : undefined;
};

const canSyncUnits = (room: OrganisationRoom) => UNIT_CAPABLE_ROOM_TYPES.has(room.type);

const buildQuery = (params: Record<string, string | boolean | undefined>) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const value = query.toString();
  return value ? `?${value}` : '';
};

const normalizeRoomPayload = (room: RoomMutationPayload): OrganisationRoom => ({
  id: room.id,
  name: room.name,
  organisationId: room.organisationId,
  code: normalizeRoomCode(room.code) || buildFallbackRoomCode(room.name),
  description: room.description,
  type: room.type,
  assignedSpecialiteis: room.assignedSpecialiteis,
  assignedStaffs: room.assignedStaffs,
  availableNow: room.availableNow,
  availabilityMode: room.availabilityMode,
  availabilityDays: room.availabilityDays,
  availabilityStartTime: room.availabilityStartTime,
  availabilityEndTime: room.availabilityEndTime,
  capabilities: room.capabilities,
});

const getDesiredUnitGroups = (source: RoomMutationPayload): RoomUnitGroupDraft[] => {
  const explicitGroups = source.units?.filter((unit) => Number(unit.count ?? 0) > 0) ?? [];
  if (explicitGroups.length) return explicitGroups;

  const totalUnits = source.availability?.totalUnits ?? 0;

  if (totalUnits <= 0) return [];

  return [
    {
      name: 'Units',
      size: 'Medium',
      count: totalUnits,
    },
  ];
};

export const loadRoomsForOrgPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, roomIdsByOrgId, setRoomsForOrg } =
    useOrganisationRoomStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load rooms.');
    return;
  }
  const hasOrgData = !roomIdsByOrgId || Object.hasOwn(roomIdsByOrgId, primaryOrgId);
  if (!shouldFetchRooms(status, hasOrgData, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const res = await getData<OrganisationRoomResponseDTO[]>(
      '/fhir/v1/organisation-room/organization/' + primaryOrgId
    );
    const rooms = res.data.map((fhirRoom) => fromOrganisationRoomRequestDTO(fhirRoom));
    setRoomsForOrg(primaryOrgId, rooms);
    await Promise.all([
      loadRoomUnitGroupsForOrg(primaryOrgId, { silent: true }),
      loadRoomUnitsForOrg(primaryOrgId, { silent: true }),
    ]);
  } catch (err) {
    console.error('Failed to load rooms:', err);
    throw err;
  }
};

const shouldFetchRooms = (
  status: ReturnType<typeof useOrganisationRoomStore.getState>['status'],
  hasOrgData: boolean,
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  if (!hasOrgData) return true;
  return status === 'idle' || status === 'error';
};

export const loadRoomUnitGroupsForOrg = async (
  organisationId: string,
  opts?: { silent?: boolean }
) => {
  const { setRoomUnitGroupsForOrg } = useOrganisationRoomStore.getState();
  try {
    const res = await getData<ReturnType<typeof toFHIRRoomUnitGroup>[]>(
      `/fhir/v1/room-unit-group${buildQuery({
        organizationId: organisationId,
        isActive: true,
      })}`
    );
    setRoomUnitGroupsForOrg(organisationId, res.data.map(fromFHIRRoomUnitGroup));
  } catch (err) {
    if (!opts?.silent) console.error('Failed to load room unit groups:', err);
    throw err;
  }
};

export const loadRoomUnitsForOrg = async (organisationId: string, opts?: { silent?: boolean }) => {
  const { setRoomUnitsForOrg } = useOrganisationRoomStore.getState();
  try {
    const res = await getData<ReturnType<typeof toFHIRRoomUnit>[]>(
      `/fhir/v1/room-unit${buildQuery({
        organizationId: organisationId,
        isActive: true,
      })}`
    );
    setRoomUnitsForOrg(organisationId, res.data.map(fromFHIRRoomUnit));
  } catch (err) {
    if (!opts?.silent) console.error('Failed to load room units:', err);
    throw err;
  }
};

const listRoomUnitsForGroup = async (
  organisationId: string,
  roomId: string,
  unitGroupId: string
) => {
  const res = await getData<ReturnType<typeof toFHIRRoomUnit>[]>(
    `/fhir/v1/room-unit${buildQuery({
      organizationId: organisationId,
      roomId,
      unitGroupId,
      isActive: true,
    })}`
  );
  return res.data.map(fromFHIRRoomUnit);
};

const createUnitGroup = async (group: RoomUnitGroup) => {
  const res = await postData<ReturnType<typeof toFHIRRoomUnitGroup>>(
    '/fhir/v1/room-unit-group',
    toFHIRRoomUnitGroup(group)
  );
  return fromFHIRRoomUnitGroup(res.data);
};

const updateUnitGroup = async (group: RoomUnitGroup) => {
  const res = await putData<ReturnType<typeof toFHIRRoomUnitGroup>>(
    `/fhir/v1/room-unit-group/${group.id}`,
    toFHIRRoomUnitGroup(group)
  );
  return fromFHIRRoomUnitGroup(res.data);
};

const createUnit = async (unit: RoomUnit) => {
  const res = await postData<ReturnType<typeof toFHIRRoomUnit>>(
    '/fhir/v1/room-unit',
    toFHIRRoomUnit(unit)
  );
  return fromFHIRRoomUnit(res.data);
};

const deleteUnit = async (unitId: string) => {
  const res = await deleteData<ReturnType<typeof toFHIRRoomUnit>>(`/fhir/v1/room-unit/${unitId}`);
  return fromFHIRRoomUnit(res.data);
};

const syncUnitsForGroup = async (
  group: RoomUnitGroup,
  desiredCount: number,
  speciesConstraints?: string[]
) => {
  const currentUnits = await listRoomUnitsForGroup(group.organisationId, group.roomId, group.id);
  const createdUnits: RoomUnit[] = [];
  const surplusUnits = currentUnits.slice(desiredCount);

  for (const unit of surplusUnits) {
    await deleteUnit(unit.id);
  }

  for (let index = currentUnits.length; index < desiredCount; index += 1) {
    const unitNumber = index + 1;
    createdUnits.push(
      await createUnit({
        id: '',
        organisationId: group.organisationId,
        roomId: group.roomId,
        unitGroupId: group.id,
        code: `${group.name}-${unitNumber}`.replace(/\s+/g, '-').toUpperCase(),
        displayName: `${group.name} ${unitNumber}`,
        size: group.size,
        speciesConstraints,
        isActive: true,
      })
    );
  }

  return [...currentUnits.slice(0, desiredCount), ...createdUnits];
};

const syncRoomUnitGroups = async (room: OrganisationRoom, source: RoomMutationPayload) => {
  if (!canSyncUnits(room)) return;

  const speciesConstraints = toSpeciesConstraints(source.availability?.species);
  const desiredUnitGroups = getDesiredUnitGroups(source);
  if (!desiredUnitGroups.length) return;

  const syncedGroups: RoomUnitGroup[] = [];
  const syncedUnits: RoomUnit[] = [];

  for (const [index, draft] of desiredUnitGroups.entries()) {
    const unitCount = Math.max(1, Number(draft.count ?? 1));
    const groupPayload: RoomUnitGroup = {
      id: draft.id?.startsWith('unit-') ? '' : (draft.id ?? ''),
      organisationId: room.organisationId,
      roomId: room.id,
      name: draft.name?.trim() || `Unit type ${index + 1}`,
      size: draft.size,
      unitCount,
      speciesConstraints: draft.speciesConstraints ?? speciesConstraints,
      capabilities: source.equipment ?? source.capabilities,
      isActive: true,
    };
    const group = groupPayload.id
      ? await updateUnitGroup(groupPayload)
      : await createUnitGroup(groupPayload);
    syncedGroups.push(group);
    syncedUnits.push(...(await syncUnitsForGroup(group, unitCount, group.speciesConstraints)));
  }

  const { setRoomUnitGroupsForRoom, setRoomUnitsForRoom } = useOrganisationRoomStore.getState();
  setRoomUnitGroupsForRoom(room.id, syncedGroups);
  setRoomUnitsForRoom(room.id, syncedUnits);
};

export const createRoom = async (room: RoomMutationPayload) => {
  const { upsertRoom } = useOrganisationRoomStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot create room.');
    return;
  }
  try {
    const payload: OrganisationRoom = {
      ...normalizeRoomPayload(room),
      organisationId: primaryOrgId,
    };
    const fhirRoom = toOrganisationRoomResponseDTO(payload);
    const res = await postData<OrganisationRoomResponseDTO>('/fhir/v1/organisation-room', fhirRoom);
    const normalRoom = {
      ...payload,
      ...fromOrganisationRoomRequestDTO(res.data),
    };
    upsertRoom(normalRoom);
    await syncRoomUnitGroups(normalRoom, room);
  } catch (err) {
    console.error('Failed to create room:', err);
    throw err;
  }
};

export const updateRoom = async (payload: RoomMutationPayload) => {
  const { upsertRoom } = useOrganisationRoomStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot update room.');
    return;
  }
  try {
    const normalizedPayload = normalizeRoomPayload({
      ...payload,
      organisationId: payload.organisationId || primaryOrgId,
    });
    const fhirRoom = toOrganisationRoomResponseDTO(normalizedPayload);
    const res = await putData<OrganisationRoomResponseDTO>(
      '/fhir/v1/organisation-room/' + payload.id,
      fhirRoom
    );
    const normalRoom = {
      ...normalizedPayload,
      ...fromOrganisationRoomRequestDTO(res.data),
    };
    upsertRoom(normalRoom);
    await syncRoomUnitGroups(normalRoom, payload);
  } catch (err) {
    console.error('Failed to update room:', err);
    throw err;
  }
};

export const toggleRoomAvailability = async (room: OrganisationRoom, isAvailable: boolean) => {
  const { upsertRoom } = useOrganisationRoomStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  const organisationId = room.organisationId || primaryOrgId;
  if (!organisationId) {
    console.warn('No primary organization selected. Cannot update room availability.');
    return;
  }
  try {
    const res = await patchData<OrganisationRoomResponseDTO>(
      `/fhir/v1/organisation-room/organization/${organisationId}/${room.id}/availability`,
      {}
    );
    const updatedRoom = {
      ...room,
      ...fromOrganisationRoomRequestDTO(res.data),
    };
    upsertRoom({
      ...updatedRoom,
      availableNow: updatedRoom.availableNow ?? isAvailable,
    });
  } catch (err) {
    console.error('Failed to update room availability:', err);
    throw err;
  }
};

export const deleteRoom = async (room: OrganisationRoom) => {
  const { removeRoom } = useOrganisationRoomStore.getState();
  try {
    const id = room.id;
    if (!id) {
      throw new Error('Room ID is missing.');
    }
    await deleteData('/fhir/v1/organisation-room/' + id);
    removeRoom(id);
  } catch (err) {
    console.error('Failed to delete room:', err);
    throw err;
  }
};
