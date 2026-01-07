import {
  Status,
  AppointmentStatus,
  AppointmentStatusOptions,
  AppointmentsProps,
  DayOfWeek,
  AvailabilityWindow,
  AvailabilityData,
  AvailabilityResponse,
  Slot,
  SlotsResponse,
} from "../../types/appointments";

describe("Appointments Types Definition", () => {

  // --- Section 1: Runtime Constants (Crucial for Coverage) ---
  describe("AppointmentStatusOptions Constant", () => {
    it("contains the correct list of status strings", () => {
      // This test executes the actual JavaScript code exported by the file
      expect(AppointmentStatusOptions).toHaveLength(7);
      expect(AppointmentStatusOptions).toEqual([
        "NO_PAYMENT",
        "REQUESTED",
        "UPCOMING",
        "CHECKED_IN",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ]);
    });
  });

  // --- Section 2: String Union Types ---
  describe("Union Types Validation", () => {
    it("accepts valid Status literal values", () => {
      const requested: Status = "Requested";
      const postCare: Status = "Post-care";
      expect(requested).toBe("Requested");
      expect(postCare).toBe("Post-care");
    });

    it("accepts valid AppointmentStatus literal values", () => {
      const noPayment: AppointmentStatus = "NO_PAYMENT";
      const checkedIn: AppointmentStatus = "CHECKED_IN";
      expect(noPayment).toBe("NO_PAYMENT");
      expect(checkedIn).toBe("CHECKED_IN");
    });

    it("accepts valid DayOfWeek literal values", () => {
      const monday: DayOfWeek = "MONDAY";
      const sunday: DayOfWeek = "SUNDAY";
      expect(monday).toBe("MONDAY");
      expect(sunday).toBe("SUNDAY");
    });
  });

  // --- Section 3: Appointment Objects Structure ---
  describe("AppointmentsProps Structure", () => {
    it("creates a valid AppointmentsProps object with Date objects", () => {
      const now = new Date();
      const appointment: AppointmentsProps = {
        name: "Buddy",
        parentName: "John Doe",
        image: "url/to/image",
        reason: "Vaccination",
        emergency: false,
        service: "General Checkup",
        room: "Room 1",
        time: "10:00 AM",
        date: "2023-10-10",
        lead: "Dr. Smith",
        leadDepartment: "General",
        support: ["Nurse A"],
        status: "Upcoming",
        breed: "Golden Retriever",
        species: "Dog",
        start: now,
        end: now,
      };

      expect(appointment.name).toBe("Buddy");
      expect(appointment.start).toBeInstanceOf(Date);
      expect(appointment.emergency).toBe(false);
    });
  });

  // --- Section 4: Availability & Slots Structure ---
  describe("Availability and Slots Types", () => {
    it("creates valid Availability Data structures", () => {
      const window: AvailabilityWindow = {
        startTime: "09:00",
        endTime: "12:00",
        isAvailable: true,
        vetIds: ["vet-1", "vet-2"],
      };

      const data: AvailabilityData = {
        date: "2023-12-25",
        dayOfWeek: "MONDAY",
        windows: [window],
      };

      const response: AvailabilityResponse = {
        success: true,
        data: data,
      };

      expect(response.success).toBe(true);
      expect(response.data.windows[0].vetIds).toContain("vet-1");
    });

    it("creates valid Slot and SlotsResponse structures", () => {
      const slot: Slot = {
        startTime: "14:00",
        endTime: "14:30",
        vetIds: ["vet-5"],
      };

      const response: SlotsResponse = {
        slots: [slot],
      };

      expect(response.slots).toHaveLength(1);
      expect(response.slots[0].endTime).toBe("14:30");
    });
  });
});