import { renderHook } from "@testing-library/react";
import {
  useLoadAppointmentsForPrimaryOrg,
  useAppointmentsForPrimaryOrg,
} from "../../hooks/useAppointments";
import { loadAppointmentsForPrimaryOrg } from "../../services/appointmentService";
import { useOrgStore } from "../../stores/orgStore";
import { useAppointmentStore } from "../../stores/appointmentStore";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// 1. Mock Service
jest.mock("../../services/appointmentService", () => ({
  loadAppointmentsForPrimaryOrg: jest.fn(),
}));

// 2. Mock Stores
// We mock the hooks to accept a selector function and return the result based on a mutable mock state
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

jest.mock("../../stores/appointmentStore", () => ({
  useAppointmentStore: jest.fn(),
}));

describe("useAppointments Hooks", () => {
  // Mutable state for mocks
  let mockOrgState: { primaryOrgId: string | null };
  let mockAppointmentState: {
    appointmentsById: Record<string, Appointment>;
    appointmentIdsByOrgId: Record<string, string[]>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default State
    mockOrgState = { primaryOrgId: null };
    mockAppointmentState = {
      appointmentsById: {},
      appointmentIdsByOrgId: {},
    };

    // Setup Store Mock Implementations
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockOrgState)
    );
    (useAppointmentStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockAppointmentState)
    );
  });

  // --- Section 1: useLoadAppointmentsForPrimaryOrg ---
  describe("useLoadAppointmentsForPrimaryOrg", () => {
    it("does nothing when primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;

      renderHook(() => useLoadAppointmentsForPrimaryOrg());

      expect(loadAppointmentsForPrimaryOrg).not.toHaveBeenCalled();
    });

    it("calls loadAppointmentsForPrimaryOrg with force:true when primaryOrgId is present", () => {
      mockOrgState.primaryOrgId = "org-1";

      renderHook(() => useLoadAppointmentsForPrimaryOrg());

      expect(loadAppointmentsForPrimaryOrg).toHaveBeenCalledTimes(1);
      expect(loadAppointmentsForPrimaryOrg).toHaveBeenCalledWith({ force: true });
    });

    it("triggers a reload when primaryOrgId changes", () => {
      mockOrgState.primaryOrgId = "org-1";
      const { rerender } = renderHook(() => useLoadAppointmentsForPrimaryOrg());

      expect(loadAppointmentsForPrimaryOrg).toHaveBeenCalledTimes(1);

      // Change Org ID
      mockOrgState.primaryOrgId = "org-2";
      rerender();

      expect(loadAppointmentsForPrimaryOrg).toHaveBeenCalledTimes(2);
    });
  });

  // --- Section 2: useAppointmentsForPrimaryOrg ---
  describe("useAppointmentsForPrimaryOrg", () => {
    const mockAppt1 = { id: "appt-1", title: "Meeting" } as unknown as Appointment;
    const mockAppt2 = { id: "appt-2", title: "Surgery" } as unknown as Appointment;

    it("returns an empty array if primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;
      // Populate store to ensure it ignores data if org ID is missing
      mockAppointmentState.appointmentIdsByOrgId["org-1"] = ["appt-1"];
      mockAppointmentState.appointmentsById["appt-1"] = mockAppt1;

      const { result } = renderHook(() => useAppointmentsForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("returns an empty array if org exists but has no appointments", () => {
      mockOrgState.primaryOrgId = "org-empty";
      mockAppointmentState.appointmentIdsByOrgId["org-empty"] = [];

      const { result } = renderHook(() => useAppointmentsForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("returns empty array if org ID is not in the index map (undefined check)", () => {
      mockOrgState.primaryOrgId = "org-new";
      // appointmentIdsByOrgId["org-new"] is undefined

      const { result } = renderHook(() => useAppointmentsForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("returns correctly mapped appointments for the primary org", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockAppointmentState.appointmentIdsByOrgId["org-1"] = ["appt-1", "appt-2"];
      mockAppointmentState.appointmentsById = {
        "appt-1": mockAppt1,
        "appt-2": mockAppt2,
        "appt-3": { id: "appt-3" } as Appointment, // Belongs to another org/list
      };

      const { result } = renderHook(() => useAppointmentsForPrimaryOrg());

      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual([mockAppt1, mockAppt2]);
    });

    it("filters out null/undefined appointments (data integrity check)", () => {
      mockOrgState.primaryOrgId = "org-1";
      // Index says we have appt-1 and appt-ghost, but map only has appt-1
      mockAppointmentState.appointmentIdsByOrgId["org-1"] = ["appt-1", "appt-ghost"];
      mockAppointmentState.appointmentsById = {
        "appt-1": mockAppt1,
      };

      const { result } = renderHook(() => useAppointmentsForPrimaryOrg());

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(mockAppt1);
    });
  });
});