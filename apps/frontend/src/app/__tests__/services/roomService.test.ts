import {
  loadRoomsForOrgPrimaryOrg,
  createRoom,
  updateRoom,
} from '@/app/features/organization/services/roomService';
import { deleteData, getData, postData, putData } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import {
  fromOrganisationRoomRequestDTO,
  toOrganisationRoomResponseDTO,
  OrganisationRoom,
  fromFHIRRoomUnitGroup,
  fromFHIRRoomUnit,
  toFHIRRoomUnitGroup,
  toFHIRRoomUnit,
} from '@yosemite-crew/types';

// --- Mocks ---
jest.mock('@/app/services/axios');
const mockedGetData = getData as jest.Mock;
const mockedPostData = postData as jest.Mock;
const mockedPutData = putData as jest.Mock;
const mockedDeleteData = deleteData as jest.Mock;

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/roomStore', () => ({
  useOrganisationRoomStore: { getState: jest.fn() },
}));

jest.mock('@yosemite-crew/types', () => ({
  ...jest.requireActual('@yosemite-crew/types'),
  fromOrganisationRoomRequestDTO: jest.fn(),
  toOrganisationRoomResponseDTO: jest.fn(),
  fromFHIRRoomUnitGroup: jest.fn(),
  fromFHIRRoomUnit: jest.fn(),
  toFHIRRoomUnitGroup: jest.fn(),
  toFHIRRoomUnit: jest.fn(),
}));
const mockedFromDTO = fromOrganisationRoomRequestDTO as jest.Mock;
const mockedToDTO = toOrganisationRoomResponseDTO as jest.Mock;
const mockedFromFHIRRoomUnitGroup = fromFHIRRoomUnitGroup as jest.Mock;
const mockedFromFHIRRoomUnit = fromFHIRRoomUnit as jest.Mock;
const mockedToFHIRRoomUnitGroup = toFHIRRoomUnitGroup as jest.Mock;
const mockedToFHIRRoomUnit = toFHIRRoomUnit as jest.Mock;

describe('Room Service', () => {
  const mockRoomStoreStartLoading = jest.fn();
  const mockRoomStoreSetRoomsForOrg = jest.fn();
  const mockRoomStoreUpsertRoom = jest.fn();
  const mockSetRoomUnitGroupsForOrg = jest.fn();
  const mockSetRoomUnitsForOrg = jest.fn();
  const mockSetRoomUnitGroupsForRoom = jest.fn();
  const mockSetRoomUnitsForRoom = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: 'org-123',
    });

    (useOrganisationRoomStore.getState as jest.Mock).mockReturnValue({
      status: 'idle',
      startLoading: mockRoomStoreStartLoading,
      setRoomsForOrg: mockRoomStoreSetRoomsForOrg,
      upsertRoom: mockRoomStoreUpsertRoom,
      setRoomUnitGroupsForOrg: mockSetRoomUnitGroupsForOrg,
      setRoomUnitsForOrg: mockSetRoomUnitsForOrg,
      setRoomUnitGroupsForRoom: mockSetRoomUnitGroupsForRoom,
      setRoomUnitsForRoom: mockSetRoomUnitsForRoom,
    });
    mockedFromFHIRRoomUnitGroup.mockImplementation((value) => value);
    mockedFromFHIRRoomUnit.mockImplementation((value) => value);
    mockedToFHIRRoomUnitGroup.mockImplementation((value) => value);
    mockedToFHIRRoomUnit.mockImplementation((value) => value);
  });

  // --- Section 1: loadRoomsForOrgPrimaryOrg ---
  describe('loadRoomsForOrgPrimaryOrg', () => {
    it('returns early if no primaryOrgId is selected', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await loadRoomsForOrgPrimaryOrg();

      expect(consoleSpy).toHaveBeenCalledWith(
        'No primary organization selected. Cannot load rooms.'
      );
      expect(mockedGetData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("skips fetch if status is 'loaded' and force is false", async () => {
      (useOrganisationRoomStore.getState as jest.Mock).mockReturnValue({
        status: 'loaded',
        startLoading: mockRoomStoreStartLoading,
        roomIdsByOrgId: { 'org-123': ['room-1'] },
      });

      await loadRoomsForOrgPrimaryOrg();

      expect(mockedGetData).not.toHaveBeenCalled();
    });

    it('fetches if force option is true even if status is loaded', async () => {
      (useOrganisationRoomStore.getState as jest.Mock).mockReturnValue({
        status: 'loaded',
        startLoading: mockRoomStoreStartLoading,
        setRoomsForOrg: mockRoomStoreSetRoomsForOrg,
        setRoomUnitGroupsForOrg: mockSetRoomUnitGroupsForOrg,
        setRoomUnitsForOrg: mockSetRoomUnitsForOrg,
      });
      mockedGetData.mockResolvedValue({ data: [] });

      await loadRoomsForOrgPrimaryOrg({ force: true });

      expect(mockedGetData).toHaveBeenCalled();
    });

    it('fetches, transforms data, and updates store on success', async () => {
      const mockApiData = [{ resourceType: 'Location', id: 'raw-1' }];
      const mockTransformedRoom = { id: 'room-1', name: 'Room 1' };

      mockedGetData
        .mockResolvedValueOnce({ data: mockApiData })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });
      mockedFromDTO.mockReturnValue(mockTransformedRoom);

      await loadRoomsForOrgPrimaryOrg();

      expect(mockRoomStoreStartLoading).toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith('/fhir/v1/organisation-room/organization/org-123');
      expect(mockedGetData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit-group?organizationId=org-123&isActive=true'
      );
      expect(mockedGetData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit?organizationId=org-123&isActive=true'
      );

      // FIX: Implementation code is: res.data.map((fhirRoom) => from...(fhirRoom))
      // This drops the index and array arguments.
      expect(mockedFromDTO).toHaveBeenCalledWith(mockApiData[0]);

      expect(mockRoomStoreSetRoomsForOrg).toHaveBeenCalledWith('org-123', [mockTransformedRoom]);
      expect(mockSetRoomUnitGroupsForOrg).toHaveBeenCalledWith('org-123', []);
      expect(mockSetRoomUnitsForOrg).toHaveBeenCalledWith('org-123', []);
    });

    it('suppresses loading state if silent option is true', async () => {
      mockedGetData.mockResolvedValue({ data: [] });
      await loadRoomsForOrgPrimaryOrg({ silent: true });

      expect(mockRoomStoreStartLoading).not.toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalled();
    });

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Fetch Error');
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(loadRoomsForOrgPrimaryOrg()).rejects.toThrow('Fetch Error');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load rooms:', error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: createRoom ---
  describe('createRoom', () => {
    const mockRoomInput = { name: 'New Room' } as OrganisationRoom;

    it('returns early if no primaryOrgId is selected', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await createRoom(mockRoomInput);

      expect(consoleSpy).toHaveBeenCalledWith(
        'No primary organization selected. Cannot create room.'
      );
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('transforms, posts, transforms response, and updates store', async () => {
      const mockDTO = { resourceType: 'Location' };
      const mockResponseData = { resourceType: 'Location', id: 'new-1' };
      const mockFinalRoom = { id: 'room-new', name: 'New Room', organisationId: 'org-123' };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPostData.mockResolvedValue({ data: mockResponseData });
      mockedFromDTO.mockReturnValue(mockFinalRoom);

      await createRoom(mockRoomInput);

      expect(mockedToDTO).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockRoomInput,
          organisationId: 'org-123',
          code: expect.stringMatching(/^NEW-ROOM-[A-Z0-9]+$/),
        })
      );

      expect(mockedPostData).toHaveBeenCalledWith('/fhir/v1/organisation-room', mockDTO);
      expect(mockedFromDTO).toHaveBeenCalledWith(mockResponseData);
      expect(mockRoomStoreUpsertRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockFinalRoom,
          organisationId: 'org-123',
        })
      );
    });

    it('carries the draft availability species onto the upserted room for non-unit rooms', async () => {
      const mockDTO = { resourceType: 'Location' };
      const mockResponseData = { resourceType: 'Location', id: 'new-2' };
      const mockFinalRoom = { id: 'room-2', name: 'Puppy Ward', organisationId: 'org-123' };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPostData.mockResolvedValue({ data: mockResponseData });
      mockedFromDTO.mockReturnValue(mockFinalRoom);

      await createRoom({
        name: 'Puppy Ward',
        type: 'EXAM_ROOM',
        availability: { species: ['CANINE', 'FELINE'], totalUnits: 0 },
      } as OrganisationRoom & { availability: { species: string[]; totalUnits: number } });

      expect(mockRoomStoreUpsertRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          availability: expect.objectContaining({ species: ['CANINE', 'FELINE'] }),
        })
      );
    });

    it('uses a provided custom room code as-is', async () => {
      const mockDTO = { resourceType: 'Location' };
      const mockResponseData = { resourceType: 'Location', id: 'new-1' };
      const mockFinalRoom = {
        id: 'room-new',
        name: 'Custom Room',
        code: 'CR-01',
        organisationId: 'org-123',
      };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPostData.mockResolvedValue({ data: mockResponseData });
      mockedFromDTO.mockReturnValue(mockFinalRoom);

      await createRoom({ name: 'Custom Room', code: ' CR-01 ' } as OrganisationRoom);

      expect(mockedToDTO).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CR-01',
        })
      );
    });

    it('creates a default unit group from total units for unit-capable rooms', async () => {
      const roomInput = {
        id: 'draft-room',
        name: 'Ward A',
        code: '',
        type: 'INPATIENT',
        availability: {
          species: ['CANINE', 'AVIAN', 'FELINE'],
          totalUnits: 2,
        },
      } as OrganisationRoom & {
        availability: { species: string[]; totalUnits: number };
      };
      const mockDTO = { resourceType: 'Location' };
      const roomResponse = { resourceType: 'Location', id: 'room-1' };
      const createdRoom = {
        id: 'room-1',
        name: 'Ward A',
        organisationId: 'org-123',
        type: 'INPATIENT',
      };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPostData
        .mockResolvedValueOnce({ data: roomResponse })
        .mockImplementation(async (_url, payload) => ({ data: payload }));
      mockedFromDTO.mockReturnValue(createdRoom);
      mockedGetData.mockResolvedValue({ data: [] });

      await createRoom(roomInput);

      expect(mockedToDTO).toHaveBeenCalledWith(
        expect.objectContaining({
          code: expect.stringMatching(/^WARD-A-[A-Z0-9]+$/),
        })
      );

      expect(mockedPostData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit-group',
        expect.objectContaining({
          name: 'Units',
          unitCount: 2,
          speciesConstraints: ['CANINE', 'FELINE'],
        })
      );
      expect(mockedPostData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit',
        expect.objectContaining({
          displayName: 'Units 1',
          code: 'UNITS-1',
        })
      );
      expect(mockedPostData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit',
        expect.objectContaining({
          displayName: 'Units 2',
          code: 'UNITS-2',
        })
      );
      expect(mockSetRoomUnitGroupsForRoom).toHaveBeenCalled();
      expect(mockSetRoomUnitsForRoom).toHaveBeenCalled();
    });

    it('keeps the created units in requested order when their POSTs settle out of order', async () => {
      const roomInput = {
        id: 'draft-room',
        name: 'Ward B',
        code: '',
        type: 'INPATIENT',
        availability: { species: ['CANINE'], totalUnits: 3 },
      } as OrganisationRoom & {
        availability: { species: string[]; totalUnits: number };
      };
      const createdRoom = {
        id: 'room-1',
        name: 'Ward B',
        organisationId: 'org-123',
        type: 'INPATIENT',
      };

      mockedToDTO.mockReturnValue({ resourceType: 'Location' });
      mockedFromDTO.mockReturnValue(createdRoom);
      mockedGetData.mockResolvedValue({ data: [] });
      mockedPostData
        .mockResolvedValueOnce({ data: { resourceType: 'Location', id: 'room-1' } })
        .mockImplementation((url: string, body: { code?: string }) => {
          // Settle the unit creates in reverse order. The synced list has to
          // follow the order the units were asked for, not whichever POST
          // came back first.
          const settleOrderMs: Record<string, number> = {
            'UNITS-1': 20,
            'UNITS-2': 10,
            'UNITS-3': 0,
          };
          const settleAfterMs =
            url === '/fhir/v1/room-unit' ? (settleOrderMs[body.code ?? ''] ?? 0) : 0;
          return new Promise((resolve) => {
            setTimeout(() => resolve({ data: body }), settleAfterMs);
          });
        });

      await createRoom(roomInput);

      expect(mockSetRoomUnitsForRoom).toHaveBeenCalledWith('room-1', [
        expect.objectContaining({ code: 'UNITS-1' }),
        expect.objectContaining({ code: 'UNITS-2' }),
        expect.objectContaining({ code: 'UNITS-3' }),
      ]);
    });

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Create Error');
      mockedToDTO.mockReturnValue({});
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(createRoom(mockRoomInput)).rejects.toThrow('Create Error');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create room:', error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 3: updateRoom ---
  describe('updateRoom', () => {
    const mockUpdateInput = { id: 'room-1', name: 'Updated Room' } as OrganisationRoom;

    it('returns early if no primaryOrgId is selected', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await updateRoom(mockUpdateInput);

      expect(consoleSpy).toHaveBeenCalledWith(
        'No primary organization selected. Cannot update room.'
      );
      expect(mockedPutData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('transforms, puts, transforms response, and updates store', async () => {
      const mockDTO = { resourceType: 'Location', id: 'raw-1' };
      const mockResponseData = { resourceType: 'Location', id: 'raw-1', name: 'Updated' };
      const mockFinalRoom = { id: 'room-1', name: 'Updated Room' };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPutData.mockResolvedValue({ data: mockResponseData });
      mockedFromDTO.mockReturnValue(mockFinalRoom);
      mockedGetData.mockResolvedValue({ data: [] });

      await updateRoom(mockUpdateInput);

      expect(mockedToDTO).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'room-1',
          name: 'Updated Room',
          organisationId: 'org-123',
        })
      );
      expect(mockedPutData).toHaveBeenCalledWith('/fhir/v1/organisation-room/room-1', mockDTO);
      expect(mockedFromDTO).toHaveBeenCalledWith(mockResponseData);
      expect(mockRoomStoreUpsertRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockFinalRoom,
          organisationId: 'org-123',
        })
      );
    });

    it('carries the draft availability species onto the upserted room', async () => {
      const mockDTO = { resourceType: 'Location', id: 'raw-2' };
      const mockResponseData = { resourceType: 'Location', id: 'raw-2' };
      const mockFinalRoom = { id: 'room-1', name: 'Updated Room' };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPutData.mockResolvedValue({ data: mockResponseData });
      mockedFromDTO.mockReturnValue(mockFinalRoom);
      mockedGetData.mockResolvedValue({ data: [] });

      await updateRoom({
        id: 'room-1',
        name: 'Updated Room',
        type: 'EXAM_ROOM',
        availability: { species: ['EQUINE'], totalUnits: 0 },
      } as OrganisationRoom & { availability: { species: string[]; totalUnits: number } });

      expect(mockRoomStoreUpsertRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          availability: expect.objectContaining({ species: ['EQUINE'] }),
        })
      );
    });

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Update Error');
      mockedToDTO.mockReturnValue({});
      mockedPutData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(updateRoom(mockUpdateInput)).rejects.toThrow('Update Error');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to update room:', error);
      consoleSpy.mockRestore();
    });

    it('deactivates stale unit groups and their units when the room type no longer supports units', async () => {
      const mockDTO = { resourceType: 'Location', id: 'room-1' };
      const mockResponseData = { resourceType: 'Location', id: 'room-1' };
      const mockFinalRoom = { id: 'room-1', name: 'Puppy Ward', type: 'SURGERY' };
      const staleGroup = {
        id: 'group-1',
        organisationId: 'org-123',
        roomId: 'room-1',
        name: 'Pod',
        size: 'Extra large',
        unitCount: 5,
        isActive: true,
      };
      const staleUnit = {
        id: 'unit-1',
        organisationId: 'org-123',
        roomId: 'room-1',
        unitGroupId: 'group-1',
        code: 'POD-1',
        displayName: 'Pod 1',
        isActive: true,
      };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPutData.mockResolvedValue({ data: mockResponseData });
      mockedFromDTO.mockReturnValue(mockFinalRoom);
      mockedGetData.mockImplementation((url: string) => {
        if (url.startsWith('/fhir/v1/room-unit-group')) {
          return Promise.resolve({ data: [staleGroup] });
        }
        if (url.startsWith('/fhir/v1/room-unit')) {
          return Promise.resolve({ data: [staleUnit] });
        }
        return Promise.resolve({ data: [] });
      });

      await updateRoom({
        id: 'room-1',
        name: 'Puppy Ward',
        type: 'SURGERY',
        availability: { species: ['CANINE'], totalUnits: 0 },
        units: [],
      } as OrganisationRoom & {
        availability: { species: string[]; totalUnits: number };
        units: [];
      });

      // Deactivated in place (not deleted) - a hard delete would cascade onto
      // RoomUnitAssignment history and null out any admission's current unit.
      expect(mockedPutData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit/unit-1',
        expect.objectContaining({ isActive: false })
      );
      expect(mockedPutData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit-group/group-1',
        expect.objectContaining({ isActive: false })
      );
      expect(mockedDeleteData).not.toHaveBeenCalled();
      expect(mockSetRoomUnitGroupsForRoom).toHaveBeenCalledWith('room-1', []);
      expect(mockSetRoomUnitsForRoom).toHaveBeenCalledWith('room-1', []);
    });

    it('does not prune unit groups when a partial update omits units and availability', async () => {
      const mockDTO = { resourceType: 'Location', id: 'room-1' };
      const mockResponseData = { resourceType: 'Location', id: 'room-1' };
      const mockFinalRoom = { id: 'room-1', name: 'Renamed Ward', type: 'INPATIENT' };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPutData.mockResolvedValue({ data: mockResponseData });
      mockedFromDTO.mockReturnValue(mockFinalRoom);

      // A rename-only payload: no `units` key, no `availability` key at all -
      // as distinct from an explicit empty list/zero total.
      await updateRoom({
        id: 'room-1',
        name: 'Renamed Ward',
        type: 'INPATIENT',
      } as OrganisationRoom);

      expect(mockedGetData).not.toHaveBeenCalledWith(
        expect.stringContaining('/fhir/v1/room-unit-group')
      );
      expect(mockedPutData).not.toHaveBeenCalledWith(
        expect.stringContaining('/fhir/v1/room-unit-group/'),
        expect.anything()
      );
      // Leaves the client-side cache alone too - there's nothing to reconcile.
      expect(mockSetRoomUnitGroupsForRoom).not.toHaveBeenCalled();
      expect(mockSetRoomUnitsForRoom).not.toHaveBeenCalled();
    });

    it('still prunes active groups when a partial update changes the room to a non-unit type', async () => {
      const mockDTO = { resourceType: 'Location', id: 'room-1' };
      const mockResponseData = { resourceType: 'Location', id: 'room-1' };
      const mockFinalRoom = { id: 'room-1', name: 'Ward A', type: 'SURGERY' };
      const staleGroup = {
        id: 'group-1',
        organisationId: 'org-123',
        roomId: 'room-1',
        name: 'Pod',
        size: 'Extra large',
        unitCount: 5,
        isActive: true,
      };
      const staleUnit = {
        id: 'unit-1',
        organisationId: 'org-123',
        roomId: 'room-1',
        unitGroupId: 'group-1',
        code: 'POD-1',
        displayName: 'Pod 1',
        isActive: true,
      };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPutData.mockResolvedValue({ data: mockResponseData });
      mockedFromDTO.mockReturnValue(mockFinalRoom);
      mockedGetData.mockImplementation((url: string) => {
        if (url.startsWith('/fhir/v1/room-unit-group')) {
          return Promise.resolve({ data: [staleGroup] });
        }
        if (url.startsWith('/fhir/v1/room-unit')) {
          return Promise.resolve({ data: [staleUnit] });
        }
        return Promise.resolve({ data: [] });
      });

      // Only the type changes - no `units`/`availability` in the payload at
      // all, unlike the full snapshot the room-edit UI always sends. The
      // omission must not be read as "leave the unit config alone", since the
      // room can no longer support one.
      await updateRoom({
        id: 'room-1',
        name: 'Ward A',
        type: 'SURGERY',
      } as OrganisationRoom);

      expect(mockedPutData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit-group/group-1',
        expect.objectContaining({ isActive: false })
      );
      expect(mockedPutData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit/unit-1',
        expect.objectContaining({ isActive: false })
      );
      expect(mockSetRoomUnitGroupsForRoom).toHaveBeenCalledWith('room-1', []);
      expect(mockSetRoomUnitsForRoom).toHaveBeenCalledWith('room-1', []);
    });

    it('reactivates an archived group and unit instead of creating duplicates with the same name/code', async () => {
      const mockDTO = { resourceType: 'Location', id: 'room-1' };
      const mockResponseData = { resourceType: 'Location', id: 'room-1' };
      const mockFinalRoom = { id: 'room-1', name: 'Ward A', type: 'INPATIENT' };
      const archivedGroup = {
        id: 'group-1',
        organisationId: 'org-123',
        roomId: 'room-1',
        name: 'Pod',
        size: 'Large',
        unitCount: 1,
        isActive: false,
      };
      const archivedUnit = {
        id: 'unit-1',
        organisationId: 'org-123',
        roomId: 'room-1',
        unitGroupId: 'group-1',
        code: 'POD-1',
        displayName: 'Pod 1',
        isActive: false,
      };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedFromDTO.mockReturnValue(mockFinalRoom);
      mockedPutData.mockImplementation((_url: string, body: unknown) =>
        Promise.resolve({ data: body })
      );
      mockedPostData.mockImplementation((_url: string, body: unknown) =>
        Promise.resolve({ data: body })
      );
      mockedGetData.mockImplementation((url: string) => {
        if (url === '/fhir/v1/organisation-room/room-1') {
          return Promise.resolve({ data: mockResponseData });
        }
        if (url.startsWith('/fhir/v1/room-unit-group')) {
          return Promise.resolve({ data: [archivedGroup] });
        }
        if (url.startsWith('/fhir/v1/room-unit')) {
          // The active-only lookup (isActive=true) sees nothing; the
          // unscoped lookup used for reactivation sees the archived row.
          return Promise.resolve({
            data: url.includes('isActive=true') ? [] : [archivedUnit],
          });
        }
        return Promise.resolve({ data: [] });
      });

      await updateRoom({
        id: 'room-1',
        name: 'Ward A',
        type: 'INPATIENT',
        availability: { species: ['CANINE'], totalUnits: 2 },
        units: [{ id: 'unit-new', name: 'Pod', size: 'Large', count: 2 }],
      } as OrganisationRoom & {
        availability: { species: string[]; totalUnits: number };
        units: Array<{ id: string; name: string; size: string; count: number }>;
      });

      // Reactivated via PUT, reusing the archived rows' own ids - a fresh POST
      // would collide on the roomId+name / roomId+code unique indexes.
      expect(mockedPutData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit-group/group-1',
        expect.objectContaining({ isActive: true })
      );
      expect(mockedPutData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit/unit-1',
        expect.objectContaining({ isActive: true })
      );
      expect(mockedPostData).not.toHaveBeenCalledWith(
        '/fhir/v1/room-unit-group',
        expect.anything()
      );
      // The second desired unit has no archived match, so it's still created fresh.
      expect(mockedPostData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit',
        expect.objectContaining({ code: 'POD-2' })
      );
    });

    it('reuses a group deactivated during the same save instead of creating a duplicate', async () => {
      const mockDTO = { resourceType: 'Location', id: 'room-1' };
      const mockFinalRoom = { id: 'room-1', name: 'Ward A', type: 'INPATIENT' };
      // The pre-deactivation snapshot: still active when fetched, since
      // pruning hasn't run yet at that point in the reconciliation.
      const activeGroupSnapshot = {
        id: 'group-1',
        organisationId: 'org-123',
        roomId: 'room-1',
        name: 'Pod',
        size: 'Large',
        unitCount: 1,
        isActive: true,
      };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedFromDTO.mockReturnValue(mockFinalRoom);
      mockedPutData.mockImplementation((_url: string, body: unknown) =>
        Promise.resolve({ data: body })
      );
      mockedPostData.mockImplementation((_url: string, body: unknown) =>
        Promise.resolve({ data: body })
      );
      mockedGetData.mockImplementation((url: string) => {
        if (url.startsWith('/fhir/v1/room-unit-group')) {
          return Promise.resolve({ data: [activeGroupSnapshot] });
        }
        return Promise.resolve({ data: [] });
      });

      // The draft list no longer references group-1's real id (it was
      // "removed") and instead has a brand-new draft also named "Pod" - all
      // within the same save.
      await updateRoom({
        id: 'room-1',
        name: 'Ward A',
        type: 'INPATIENT',
        availability: { species: ['CANINE'], totalUnits: 1 },
        units: [{ id: 'unit-new', name: 'Pod', size: 'Large', count: 1 }],
      } as OrganisationRoom & {
        availability: { species: string[]; totalUnits: number };
        units: Array<{ id: string; name: string; size: string; count: number }>;
      });

      // Deactivated by pruning, then reactivated in the same pass by reusing
      // its own id - never recreated fresh, which would collide on
      // roomId+name.
      expect(mockedPutData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit-group/group-1',
        expect.objectContaining({ isActive: false })
      );
      expect(mockedPutData).toHaveBeenCalledWith(
        '/fhir/v1/room-unit-group/group-1',
        expect.objectContaining({ isActive: true })
      );
      expect(mockedPostData).not.toHaveBeenCalledWith(
        '/fhir/v1/room-unit-group',
        expect.anything()
      );
    });

    it('deletes only the surplus units when a group is shrunk', async () => {
      const mockDTO = { resourceType: 'Location', id: 'room-1' };
      const mockFinalRoom = { id: 'room-1', name: 'Ward A', type: 'INPATIENT' };
      const activeGroup = {
        id: 'group-1',
        organisationId: 'org-123',
        roomId: 'room-1',
        name: 'Pod',
        size: 'Large',
        unitCount: 3,
        isActive: true,
      };
      const activeUnits = [1, 2, 3].map((unitNumber) => ({
        id: `unit-${unitNumber}`,
        organisationId: 'org-123',
        roomId: 'room-1',
        unitGroupId: 'group-1',
        code: `POD-${unitNumber}`,
        displayName: `Pod ${unitNumber}`,
        isActive: true,
      }));

      mockedToDTO.mockReturnValue(mockDTO);
      mockedFromDTO.mockReturnValue(mockFinalRoom);
      mockedPutData.mockImplementation((_url: string, body: unknown) =>
        Promise.resolve({ data: body })
      );
      mockedDeleteData.mockImplementation((url: string) =>
        Promise.resolve({ data: { id: url.split('/').pop() } })
      );
      mockedGetData.mockImplementation((url: string) => {
        if (url.startsWith('/fhir/v1/room-unit-group')) {
          return Promise.resolve({ data: [activeGroup] });
        }
        if (url.startsWith('/fhir/v1/room-unit')) {
          return Promise.resolve({ data: activeUnits });
        }
        return Promise.resolve({ data: [] });
      });

      await updateRoom({
        id: 'room-1',
        name: 'Ward A',
        type: 'INPATIENT',
        availability: { species: ['CANINE'], totalUnits: 1 },
        units: [{ id: 'group-1', name: 'Pod', size: 'Large', count: 1 }],
      } as OrganisationRoom & {
        availability: { species: string[]; totalUnits: number };
        units: Array<{ id: string; name: string; size: string; count: number }>;
      });

      // Only the rows past the new count go. The survivor keeps its own row
      // rather than being deleted and recreated, which is what its assignment
      // history hangs off.
      expect(mockedDeleteData).toHaveBeenCalledWith('/fhir/v1/room-unit/unit-2');
      expect(mockedDeleteData).toHaveBeenCalledWith('/fhir/v1/room-unit/unit-3');
      expect(mockedDeleteData).not.toHaveBeenCalledWith('/fhir/v1/room-unit/unit-1');
      expect(mockedPostData).not.toHaveBeenCalledWith('/fhir/v1/room-unit', expect.anything());
      expect(mockSetRoomUnitsForRoom).toHaveBeenCalledWith('room-1', [
        expect.objectContaining({ id: 'unit-1' }),
      ]);
    });
  });
});
