import {
  loadRoomsForOrgPrimaryOrg,
  createRoom,
  updateRoom,
} from "../../services/roomService";
import { getData, postData, putData } from "../../services/axios";
import { useOrgStore } from "../../stores/orgStore";
import { useOrganisationRoomStore } from "../../stores/roomStore";
import {
  fromOrganisationRoomRequestDTO,
  toOrganisationRoomResponseDTO,
  OrganisationRoom,
} from "@yosemite-crew/types";

// --- Mocks ---
jest.mock("../../services/axios");
const mockedGetData = getData as jest.Mock;
const mockedPostData = postData as jest.Mock;
const mockedPutData = putData as jest.Mock;

jest.mock("../../stores/orgStore", () => ({
  useOrgStore: { getState: jest.fn() },
}));

jest.mock("../../stores/roomStore", () => ({
  useOrganisationRoomStore: { getState: jest.fn() },
}));

jest.mock("@yosemite-crew/types", () => ({
  fromOrganisationRoomRequestDTO: jest.fn(),
  toOrganisationRoomResponseDTO: jest.fn(),
}));
const mockedFromDTO = fromOrganisationRoomRequestDTO as jest.Mock;
const mockedToDTO = toOrganisationRoomResponseDTO as jest.Mock;

describe("Room Service", () => {
  const mockRoomStoreStartLoading = jest.fn();
  const mockRoomStoreSetRoomsForOrg = jest.fn();
  const mockRoomStoreUpsertRoom = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-123",
    });

    (useOrganisationRoomStore.getState as jest.Mock).mockReturnValue({
      status: "idle",
      startLoading: mockRoomStoreStartLoading,
      setRoomsForOrg: mockRoomStoreSetRoomsForOrg,
      upsertRoom: mockRoomStoreUpsertRoom,
    });
  });

  // --- Section 1: loadRoomsForOrgPrimaryOrg ---
  describe("loadRoomsForOrgPrimaryOrg", () => {
    it("returns early if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await loadRoomsForOrgPrimaryOrg();

      expect(consoleSpy).toHaveBeenCalledWith("No primary organization selected. Cannot load specialities.");
      expect(mockedGetData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("skips fetch if status is 'loaded' and force is false", async () => {
      (useOrganisationRoomStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockRoomStoreStartLoading,
      });

      await loadRoomsForOrgPrimaryOrg();

      expect(mockedGetData).not.toHaveBeenCalled();
    });

    it("fetches if force option is true even if status is loaded", async () => {
      (useOrganisationRoomStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockRoomStoreStartLoading,
        setRoomsForOrg: mockRoomStoreSetRoomsForOrg,
      });
      mockedGetData.mockResolvedValue({ data: [] });

      await loadRoomsForOrgPrimaryOrg({ force: true });

      expect(mockedGetData).toHaveBeenCalled();
    });

    it("fetches, transforms data, and updates store on success", async () => {
      const mockApiData = [{ resourceType: "Location", id: "raw-1" }];
      const mockTransformedRoom = { id: "room-1", name: "Room 1" };

      mockedGetData.mockResolvedValue({ data: mockApiData });
      mockedFromDTO.mockReturnValue(mockTransformedRoom);

      await loadRoomsForOrgPrimaryOrg();

      expect(mockRoomStoreStartLoading).toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith("/fhir/v1/organisation-room/organization/org-123");

      // FIX: Implementation code is: res.data.map((fhirRoom) => from...(fhirRoom))
      // This drops the index and array arguments.
      expect(mockedFromDTO).toHaveBeenCalledWith(mockApiData[0]);

      expect(mockRoomStoreSetRoomsForOrg).toHaveBeenCalledWith("org-123", [mockTransformedRoom]);
    });

    it("suppresses loading state if silent option is true", async () => {
      mockedGetData.mockResolvedValue({ data: [] });
      await loadRoomsForOrgPrimaryOrg({ silent: true });

      expect(mockRoomStoreStartLoading).not.toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalled();
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Fetch Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(loadRoomsForOrgPrimaryOrg()).rejects.toThrow("Fetch Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load specialities:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: createRoom ---
  describe("createRoom", () => {
    const mockRoomInput = { name: "New Room" } as OrganisationRoom;

    it("returns early if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await createRoom(mockRoomInput);

      expect(consoleSpy).toHaveBeenCalledWith("No primary organization selected. Cannot load companions.");
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("transforms, posts, transforms response, and updates store", async () => {
      const mockDTO = { resourceType: "Location" };
      const mockResponseData = { resourceType: "Location", id: "new-1" };
      const mockFinalRoom = { id: "room-new", name: "New Room", organisationId: "org-123" };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPostData.mockResolvedValue({ data: mockResponseData });
      mockedFromDTO.mockReturnValue(mockFinalRoom);

      await createRoom(mockRoomInput);

      expect(mockedToDTO).toHaveBeenCalledWith(expect.objectContaining({
        ...mockRoomInput,
        organisationId: "org-123"
      }));

      expect(mockedPostData).toHaveBeenCalledWith("/fhir/v1/organisation-room", mockDTO);
      expect(mockedFromDTO).toHaveBeenCalledWith(mockResponseData);
      expect(mockRoomStoreUpsertRoom).toHaveBeenCalledWith(mockFinalRoom);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Create Error");
      mockedToDTO.mockReturnValue({});
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(createRoom(mockRoomInput)).rejects.toThrow("Create Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create service:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 3: updateRoom ---
  describe("updateRoom", () => {
    const mockUpdateInput = { id: "room-1", name: "Updated Room" } as OrganisationRoom;

    it("returns early if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await updateRoom(mockUpdateInput);

      expect(consoleSpy).toHaveBeenCalledWith("No primary organization selected. Cannot load companions.");
      expect(mockedPutData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("transforms, puts, transforms response, and updates store", async () => {
      const mockDTO = { resourceType: "Location", id: "raw-1" };
      const mockResponseData = { resourceType: "Location", id: "raw-1", name: "Updated" };
      const mockFinalRoom = { id: "room-1", name: "Updated Room" };

      mockedToDTO.mockReturnValue(mockDTO);
      mockedPutData.mockResolvedValue({ data: mockResponseData });
      mockedFromDTO.mockReturnValue(mockFinalRoom);

      await updateRoom(mockUpdateInput);

      expect(mockedToDTO).toHaveBeenCalledWith(mockUpdateInput);
      expect(mockedPutData).toHaveBeenCalledWith("/fhir/v1/organisation-room/room-1", mockDTO);
      expect(mockedFromDTO).toHaveBeenCalledWith(mockResponseData);
      expect(mockRoomStoreUpsertRoom).toHaveBeenCalledWith(mockFinalRoom);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Update Error");
      mockedToDTO.mockReturnValue({});
      mockedPutData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(updateRoom(mockUpdateInput)).rejects.toThrow("Update Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create service:", error);
      consoleSpy.mockRestore();
    });
  });
});