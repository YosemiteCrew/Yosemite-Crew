import {
  loadRoomsForOrgPrimaryOrg,
  createRoom,
  updateRoom,
} from '@/app/features/organization/services/roomService';
import { getData, postData, putData } from '@/app/services/axios';
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

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Update Error');
      mockedToDTO.mockReturnValue({});
      mockedPutData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(updateRoom(mockUpdateInput)).rejects.toThrow('Update Error');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to update room:', error);
      consoleSpy.mockRestore();
    });
  });
});
