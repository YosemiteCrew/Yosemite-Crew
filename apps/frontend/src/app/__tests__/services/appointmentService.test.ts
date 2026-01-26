// appointmentService.test.ts
import {
  loadAppointmentsForPrimaryOrg,
  createAppointment,
  updateAppointment,
  getSlotsForServiceAndDateForPrimaryOrg,
  toSlotsArray,
  acceptAppointment,
  cancelAppointment,
} from "../../services/appointmentService";

import { getData, patchData, postData } from "../../services/axios";
import { useOrgStore } from "../../stores/orgStore";
import { useAppointmentStore } from "../../stores/appointmentStore";
import { formatDateLocal } from "../../utils/date";

import {
  fromAppointmentRequestDTO,
  toAppointmentResponseDTO,
} from "@yosemite-crew/types";

import type {
  Appointment,
  AppointmentResponseDTO,
} from "@yosemite-crew/types";

import type { AvailabilityResponse, Slot } from "../../types/appointments";

// --- Mocks ---

// 1. Mock Axios
jest.mock("../../services/axios");
const mockedGetData = getData as jest.Mock;
const mockedPostData = postData as jest.Mock;
const mockedPatchData = patchData as jest.Mock;

// 2. Mock Stores
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock("../../stores/appointmentStore", () => ({
  useAppointmentStore: Object.assign(jest.fn(), {
    getState: jest.fn(),
  }),
}));

// 3. Mock Utils
jest.mock("../../utils/date", () => ({
  formatDateLocal: jest.fn(),
}));
const mockedFormatDateLocal = formatDateLocal as jest.Mock;

// 4. Mock External DTO mappers
jest.mock("@yosemite-crew/types", () => ({
  fromAppointmentRequestDTO: jest.fn(),
  toAppointmentResponseDTO: jest.fn(),
}));
const mockedFromAppointmentDTO = fromAppointmentRequestDTO as jest.Mock;
const mockedToAppointmentDTO = toAppointmentResponseDTO as jest.Mock;

describe("Appointment Service", () => {
  // Store spies
  const mockAppointmentStoreStartLoading = jest.fn();
  const mockAppointmentStoreSetAppointmentsForOrg = jest.fn();
  const mockAppointmentStoreUpsertAppointment = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Store State Setup
    (useAppointmentStore.getState as jest.Mock).mockReturnValue({
      startLoading: mockAppointmentStoreStartLoading,
      setAppointmentsForOrg: mockAppointmentStoreSetAppointmentsForOrg,
      upsertAppointment: mockAppointmentStoreUpsertAppointment,
      status: "idle",
      appointmentsById: {},
    });

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-123",
    });

    mockedFormatDateLocal.mockReturnValue("2026-01-06");
  });

  // --- Helpers ---
  const makeBaseAppointment = (overrides: Partial<Appointment> = {}): Appointment => {
    const now = new Date();
    return {
      id: "appt-1",
      companion: {
        id: "comp-1",
        name: "Mochi",
        species: "Dog",
        parent: { id: "parent-1", name: "Alex" },
      },
      organisationId: "org-123",
      appointmentDate: now,
      startTime: now,
      timeSlot: "10:00",
      durationMinutes: 30,
      endTime: now,
      status: "UPCOMING",
      ...overrides,
    };
  };

  // --- Section 1: loadAppointmentsForPrimaryOrg ---
  describe("loadAppointmentsForPrimaryOrg", () => {
    it("warns and returns if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await loadAppointmentsForPrimaryOrg();

      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot load appointments."
      );
      expect(mockedGetData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("skips fetch if status is 'loaded' and not forced", async () => {
      (useAppointmentStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockAppointmentStoreStartLoading,
        setAppointmentsForOrg: mockAppointmentStoreSetAppointmentsForOrg,
      });

      await loadAppointmentsForPrimaryOrg();

      expect(mockedGetData).not.toHaveBeenCalled();
    });

    it("fetches if forced even when loaded", async () => {
      (useAppointmentStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockAppointmentStoreStartLoading,
        setAppointmentsForOrg: mockAppointmentStoreSetAppointmentsForOrg,
      });

      mockedGetData.mockResolvedValue({ data: { data: [] } });

      await loadAppointmentsForPrimaryOrg({ force: true });

      expect(mockedGetData).toHaveBeenCalledWith(
        "/fhir/v1/appointment/pms/organisation/org-123"
      );
    });

    it("does not trigger startLoading if silent option is true", async () => {
      mockedGetData.mockResolvedValue({ data: { data: [] } });

      await loadAppointmentsForPrimaryOrg({ silent: true });

      expect(mockAppointmentStoreStartLoading).not.toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith(
        "/fhir/v1/appointment/pms/organisation/org-123"
      );
    });

    it("fetches successfully, maps DTOs, and updates store", async () => {
      const dto1 = { id: "dto-1" } as any as AppointmentResponseDTO;
      const dto2 = { id: "dto-2" } as any as AppointmentResponseDTO;

      mockedGetData.mockResolvedValue({ data: { data: [dto1, dto2] } });

      mockedFromAppointmentDTO
        .mockReturnValueOnce(makeBaseAppointment({ id: "appt-1" }))
        .mockReturnValueOnce(makeBaseAppointment({ id: "appt-2" }));

      await loadAppointmentsForPrimaryOrg();

      expect(mockAppointmentStoreStartLoading).toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith(
        "/fhir/v1/appointment/pms/organisation/org-123"
      );

      expect(mockedFromAppointmentDTO).toHaveBeenCalledTimes(2);
      expect(mockedFromAppointmentDTO).toHaveBeenNthCalledWith(1, dto1);
      expect(mockedFromAppointmentDTO).toHaveBeenNthCalledWith(2, dto2);

      expect(mockAppointmentStoreSetAppointmentsForOrg).toHaveBeenCalledWith(
        "org-123",
        [expect.any(Object), expect.any(Object)]
      );
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Network Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(loadAppointmentsForPrimaryOrg()).rejects.toThrow("Network Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load appointments:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: createAppointment ---
  describe("createAppointment", () => {
    it("warns and returns if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await createAppointment(makeBaseAppointment());

      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot create appointment."
      );
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("posts converted DTO and upserts mapped appointment on success", async () => {
      const appointment = makeBaseAppointment({ organisationId: "org-will-be-overwritten" });
      const fhirPayload = { fhir: true };
      const returnedDTO = { id: "returned-dto" } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: "appt-created" });

      mockedToAppointmentDTO.mockReturnValue(fhirPayload);
      mockedPostData.mockResolvedValue({ data: { data: { appointment: returnedDTO } } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await createAppointment(appointment);

      expect(mockedToAppointmentDTO).toHaveBeenCalledWith(
        expect.objectContaining({ organisationId: "org-123" })
      );
      expect(mockedPostData).toHaveBeenCalledWith(
        "/fhir/v1/appointment/pms?createPayment=true",
        fhirPayload
      );
      expect(mockedFromAppointmentDTO).toHaveBeenCalledWith(returnedDTO);
      expect(mockAppointmentStoreUpsertAppointment).toHaveBeenCalledWith(returnedAppointment);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Create Error");
      mockedToAppointmentDTO.mockReturnValue({ fhir: true });
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(createAppointment(makeBaseAppointment())).rejects.toThrow("Create Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create appointment:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 3: updateAppointment ---
  describe("updateAppointment", () => {
    it("warns and returns if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await updateAppointment(makeBaseAppointment());

      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot update appointment."
      );
      expect(mockedPatchData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("warns and returns if payload is missing appointment.id", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const payload = makeBaseAppointment({ id: undefined });

      await updateAppointment(payload);

      expect(consoleSpy).toHaveBeenCalledWith(
        "updateAppointment: missing appointment.id",
        payload
      );
      expect(mockedPatchData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("patches converted DTO and upserts mapped appointment on success", async () => {
      const payload = makeBaseAppointment({ id: "appt-10", organisationId: "org-123" });
      const fhirPayload = { fhir: "update" };
      const returnedDTO = { id: "returned-update-dto" } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: "appt-10", status: "CHECKED_IN" });

      mockedToAppointmentDTO.mockReturnValue(fhirPayload);
      mockedPatchData.mockResolvedValue({ data: { data: returnedDTO } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await updateAppointment(payload);

      expect(mockedToAppointmentDTO).toHaveBeenCalledWith(payload);
      expect(mockedPatchData).toHaveBeenCalledWith(
        "/fhir/v1/appointment/pms/org-123/appt-10",
        fhirPayload
      );
      expect(mockedFromAppointmentDTO).toHaveBeenCalledWith(returnedDTO);
      expect(mockAppointmentStoreUpsertAppointment).toHaveBeenCalledWith(returnedAppointment);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Update Error");
      mockedToAppointmentDTO.mockReturnValue({ fhir: "update" });
      mockedPatchData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(updateAppointment(makeBaseAppointment({ id: "appt-11" }))).rejects.toThrow(
        "Update Error"
      );
      expect(consoleSpy).toHaveBeenCalledWith("Failed to update appointment:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 4: getSlotsForServiceAndDateForPrimaryOrg + toSlotsArray ---
  describe("Slots", () => {
    it("warns and returns [] if no primaryOrgId", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await getSlotsForServiceAndDateForPrimaryOrg("svc-1", new Date());

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot load companions."
      );
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("returns [] if serviceId is missing", async () => {
      const result = await getSlotsForServiceAndDateForPrimaryOrg("", new Date());
      expect(result).toEqual([]);
      expect(mockedPostData).not.toHaveBeenCalled();
    });

    it("returns [] if date is missing", async () => {
      const result = await getSlotsForServiceAndDateForPrimaryOrg("svc-1", null as any);
      expect(result).toEqual([]);
      expect(mockedPostData).not.toHaveBeenCalled();
    });

    it("posts correct payload and returns mapped slots", async () => {
      mockedFormatDateLocal.mockReturnValue("2026-01-06");

      const availability: AvailabilityResponse = {
        success: true,
        data: {
          date: "2026-01-06",
          dayOfWeek: "TUESDAY" as any,
          windows: [
            { startTime: "09:00", endTime: "09:30", vetIds: ["vet-1"] } as any,
            { startTime: "10:00", endTime: "10:30", vetIds: ["vet-2", "vet-3"] } as any,
          ],
        } as any,
      };

      mockedPostData.mockResolvedValue({ data: availability });

      const result = await getSlotsForServiceAndDateForPrimaryOrg("svc-1", new Date());

      expect(mockedPostData).toHaveBeenCalledWith("/fhir/v1/service/bookable-slots", {
        serviceId: "svc-1",
        organisationId: "org-123",
        date: "2026-01-06",
      });

      expect(result).toEqual<Slot[]>([
        { startTime: "09:00", endTime: "09:30", vetIds: ["vet-1"] },
        { startTime: "10:00", endTime: "10:30", vetIds: ["vet-2", "vet-3"] },
      ]);
    });

    it("toSlotsArray maps windows to Slot[] and handles missing windows", () => {
      const withWindows: AvailabilityResponse = {
        success: true,
        data: {
          windows: [
            { startTime: "11:00", endTime: "11:30", vetIds: ["vet-9"] } as any,
          ],
        } as any,
      };

      expect(toSlotsArray(withWindows)).toEqual([
        { startTime: "11:00", endTime: "11:30", vetIds: ["vet-9"] },
      ]);

      const noWindows: AvailabilityResponse = { success: true, data: {} as any };
      expect(toSlotsArray(noWindows)).toEqual([]);
    });

    it("logs error and rethrows on slot fetch failure", async () => {
      const error = new Error("Slots Error");
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        getSlotsForServiceAndDateForPrimaryOrg("svc-1", new Date())
      ).rejects.toThrow("Slots Error");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to create service:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 5: acceptAppointment ---
  describe("acceptAppointment", () => {
    it("returns if appointment.id is missing", async () => {
      mockedPostData.mockResolvedValue({});
      await acceptAppointment(makeBaseAppointment({ id: undefined }));
      expect(mockedPostData).not.toHaveBeenCalled();
      expect(mockAppointmentStoreUpsertAppointment).not.toHaveBeenCalled();
    });

    it("posts accept route and upserts mapped appointment on success", async () => {
      const appointment = makeBaseAppointment({ id: "appt-acc" });
      const fhirPayload = { fhir: "accept" };
      const returnedDTO = { id: "dto-acc" } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: "appt-acc", status: "CHECKED_IN" });

      mockedToAppointmentDTO.mockReturnValue(fhirPayload);
      mockedPostData.mockResolvedValue({ data: { data: { appointment: returnedDTO } } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await acceptAppointment(appointment);

      expect(mockedPostData).toHaveBeenCalledWith(
        "/fhir/v1/appointment/pms/appt-acc/accept",
        fhirPayload
      );
      expect(mockAppointmentStoreUpsertAppointment).toHaveBeenCalledWith(returnedAppointment);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Accept Error");
      mockedToAppointmentDTO.mockReturnValue({ fhir: "accept" });
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(acceptAppointment(makeBaseAppointment({ id: "appt-acc2" }))).rejects.toThrow(
        "Accept Error"
      );
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create appointment:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 6: cancelAppointment ---
  describe("cancelAppointment", () => {
    it("returns if appointment.id is missing", async () => {
      mockedPostData.mockResolvedValue({});
      await cancelAppointment(makeBaseAppointment({ id: undefined }));
      expect(mockedPostData).not.toHaveBeenCalled();
      expect(mockAppointmentStoreUpsertAppointment).not.toHaveBeenCalled();
    });

    it("posts cancel route and upserts mapped appointment on success", async () => {
      const appointment = makeBaseAppointment({ id: "appt-can" });
      const fhirPayload = { fhir: "cancel" };
      const returnedDTO = { id: "dto-can" } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: "appt-can", status: "CANCELLED" });

      mockedToAppointmentDTO.mockReturnValue(fhirPayload);
      mockedPostData.mockResolvedValue({ data: { data: { appointment: returnedDTO } } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await cancelAppointment(appointment);

      expect(mockedPostData).toHaveBeenCalledWith(
        "/fhir/v1/appointment/pms/appt-can/cancel",
        fhirPayload
      );
      expect(mockAppointmentStoreUpsertAppointment).toHaveBeenCalledWith(returnedAppointment);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Cancel Error");
      mockedToAppointmentDTO.mockReturnValue({ fhir: "cancel" });
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(cancelAppointment(makeBaseAppointment({ id: "appt-can2" }))).rejects.toThrow(
        "Cancel Error"
      );
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create appointment:", error);
      consoleSpy.mockRestore();
    });
  });
});
