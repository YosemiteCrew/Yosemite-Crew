import { useAppointmentStore } from "../../stores/appointmentStore";
import { Appointment } from "@yosemite-crew/types";

// --- Mock Data ---
// We cast to unknown first to bypass strict type checking for mocks
const mockAppt1: Appointment = {
  id: "appt-1",
  organisationId: "org-A",
  appointmentDate: "2023-10-10T10:00:00Z",
} as unknown as Appointment;

const mockAppt2: Appointment = {
  id: "appt-2",
  organisationId: "org-A",
  appointmentDate: "2023-10-10T12:00:00Z",
} as unknown as Appointment;

const mockAppt3: Appointment = {
  id: "appt-3",
  organisationId: "org-B",
  appointmentDate: "2023-10-11T09:00:00Z",
} as unknown as Appointment;

describe("Appointment Store", () => {
  // Reset store before each test to ensure isolation
  beforeEach(() => {
    useAppointmentStore.setState({
      appointmentsById: {},
      appointmentIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization & Status Management ---
  describe("Initialization & Status", () => {
    it("initializes with default state", () => {
      const state = useAppointmentStore.getState();
      expect(state.status).toBe("idle");
      expect(state.appointmentsById).toEqual({});
      expect(state.appointmentIdsByOrgId).toEqual({});
      expect(state.error).toBeNull();
    });

    it("manages loading state correctly", () => {
      const store = useAppointmentStore.getState();

      store.startLoading();
      expect(useAppointmentStore.getState().status).toBe("loading");
      expect(useAppointmentStore.getState().error).toBeNull();

      store.endLoading();
      expect(useAppointmentStore.getState().status).toBe("loaded");
      expect(useAppointmentStore.getState().lastFetchedAt).toBeDefined();
    });

    it("sets error state correctly", () => {
      const store = useAppointmentStore.getState();
      store.setError("Failed to fetch");

      expect(useAppointmentStore.getState().status).toBe("error");
      expect(useAppointmentStore.getState().error).toBe("Failed to fetch");
    });
  });

  // --- Section 2: Bulk Operations & Getters ---
  describe("Bulk Sets & Getters", () => {
    it("sets all appointments globally and indexes them correctly", () => {
      const store = useAppointmentStore.getState();
      store.setAppointments([mockAppt1, mockAppt2, mockAppt3]);

      const state = useAppointmentStore.getState();
      expect(state.status).toBe("loaded");
      expect(state.appointmentsById["appt-1"]).toEqual(mockAppt1);
      expect(state.appointmentsById["appt-3"]).toEqual(mockAppt3);

      // Verify indexing
      expect(state.appointmentIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.appointmentIdsByOrgId["org-A"]).toContain("appt-1");
      expect(state.appointmentIdsByOrgId["org-A"]).toContain("appt-2");
      expect(state.appointmentIdsByOrgId["org-B"]).toHaveLength(1);
    });

    it("sets appointments for a specific organization specifically", () => {
      // Setup initial state with Org A and Org B
      useAppointmentStore.getState().setAppointments([mockAppt1, mockAppt3]);

      // Update ONLY Org A (replace appt-1 with appt-2)
      useAppointmentStore.getState().setAppointmentsForOrg("org-A", [mockAppt2]);

      const state = useAppointmentStore.getState();

      // Org A should now only have appt-2
      expect(state.appointmentIdsByOrgId["org-A"]).toEqual(["appt-2"]);
      expect(state.appointmentsById["appt-1"]).toBeUndefined(); // Should be removed
      expect(state.appointmentsById["appt-2"]).toBeDefined();   // Should be added

      // Org B should remain untouched
      expect(state.appointmentIdsByOrgId["org-B"]).toEqual(["appt-3"]);
      expect(state.appointmentsById["appt-3"]).toBeDefined();
    });

    it("retrieves appointments by Org ID", () => {
      useAppointmentStore.getState().setAppointments([mockAppt1, mockAppt2, mockAppt3]);

      const orgA_Appts = useAppointmentStore.getState().getAppointmentsByOrgId("org-A");
      expect(orgA_Appts).toHaveLength(2);
      expect(orgA_Appts.find(a => a.id === "appt-1")).toBeDefined();

      // Non-existent Org
      expect(useAppointmentStore.getState().getAppointmentsByOrgId("org-C")).toEqual([]);
    });

    it("retrieves a single appointment by ID", () => {
      useAppointmentStore.getState().setAppointments([mockAppt1]);

      expect(useAppointmentStore.getState().getAppointmentById("appt-1")).toEqual(mockAppt1);
      expect(useAppointmentStore.getState().getAppointmentById("missing")).toBeUndefined();
    });
  });

  // --- Section 3: Upsert (Add/Update) Operations ---
  describe("Upsert Operations", () => {
    it("adds a new appointment if it does not exist", () => {
      useAppointmentStore.getState().setAppointments([mockAppt1]);

      // Upsert new appt-2
      useAppointmentStore.getState().upsertAppointment(mockAppt2);

      const state = useAppointmentStore.getState();
      expect(state.appointmentsById["appt-2"]).toBeDefined();
      expect(state.appointmentIdsByOrgId["org-A"]).toContain("appt-2");
      expect(state.appointmentIdsByOrgId["org-A"]).toHaveLength(2);
    });

    it("updates an existing appointment", () => {
      useAppointmentStore.getState().setAppointments([mockAppt1]);

      // FIX: Use 'as unknown' to cast partial mock safely
      const updatedAppt1 = {
        ...mockAppt1,
        appointmentDate: "2023-12-25T00:00:00Z"
      } as unknown as Appointment;

      useAppointmentStore.getState().upsertAppointment(updatedAppt1);

      const state = useAppointmentStore.getState();
      // Verify update occurred on a valid field
      expect(state.appointmentsById["appt-1"].appointmentDate).toBe("2023-12-25T00:00:00Z");
      // Should not duplicate the ID in the list
      expect(state.appointmentIdsByOrgId["org-A"]).toHaveLength(1);
    });

    it("handles upsert gracefully when organisationId is missing", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      // FIX: Use 'as unknown' to cast partial mock safely
      const invalidAppt = { id: "bad-appt" } as unknown as Appointment;

      // Should fail safely
      useAppointmentStore.getState().upsertAppointment(invalidAppt);

      // Verify state didn't change (no junk data added)
      expect(useAppointmentStore.getState().appointmentsById["bad-appt"]).toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        "upsertAppointment: missing organisationId:",
        invalidAppt
      );

      consoleSpy.mockRestore();
    });

    it("handles upsert for a new organization not yet in store", () => {
      // Upsert appt-3 (Org B) into empty store
      useAppointmentStore.getState().upsertAppointment(mockAppt3);

      const state = useAppointmentStore.getState();
      expect(state.appointmentIdsByOrgId["org-B"]).toEqual(["appt-3"]);
    });
  });

  // --- Section 4: Removal & Cleanup Operations ---
  describe("Removal & Clearing", () => {
    it("removes an appointment by ID", () => {
      useAppointmentStore.getState().setAppointments([mockAppt1, mockAppt2]);

      useAppointmentStore.getState().removeAppointment("appt-1");

      const state = useAppointmentStore.getState();
      expect(state.appointmentsById["appt-1"]).toBeUndefined();
      expect(state.appointmentsById["appt-2"]).toBeDefined();
      expect(state.appointmentIdsByOrgId["org-A"]).toEqual(["appt-2"]);
    });

    it("does nothing when removing a non-existent ID", () => {
      useAppointmentStore.getState().setAppointments([mockAppt1]);
      const initialSnapshot = JSON.stringify(useAppointmentStore.getState());

      useAppointmentStore.getState().removeAppointment("fake-id");

      const finalSnapshot = JSON.stringify(useAppointmentStore.getState());
      expect(finalSnapshot).toEqual(initialSnapshot);
    });

    it("clears all appointments for a specific organization", () => {
      useAppointmentStore.getState().setAppointments([mockAppt1, mockAppt3]);

      useAppointmentStore.getState().clearAppointmentsForOrg("org-A");

      const state = useAppointmentStore.getState();
      // Org A data gone
      expect(state.appointmentIdsByOrgId["org-A"]).toBeUndefined();
      expect(state.appointmentsById["appt-1"]).toBeUndefined();

      // Org B data remains
      expect(state.appointmentIdsByOrgId["org-B"]).toBeDefined();
      expect(state.appointmentsById["appt-3"]).toBeDefined();
    });

    it("handles clearing an organization that has no data safely", () => {
      useAppointmentStore.getState().setAppointments([mockAppt1]);

      // Clear empty org
      useAppointmentStore.getState().clearAppointmentsForOrg("org-Empty");

      // Should just remove the key (if it existed) or do nothing, mainly ensuring no crash
      const state = useAppointmentStore.getState();
      expect(state.appointmentIdsByOrgId["org-Empty"]).toBeUndefined();
      expect(state.appointmentsById["appt-1"]).toBeDefined();
    });

    it("clears the entire store", () => {
      useAppointmentStore.getState().setAppointments([mockAppt1, mockAppt3]);

      useAppointmentStore.getState().clearAppointments();

      const state = useAppointmentStore.getState();
      expect(state.appointmentsById).toEqual({});
      expect(state.appointmentIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.lastFetchedAt).toBeNull();
    });
  });
});