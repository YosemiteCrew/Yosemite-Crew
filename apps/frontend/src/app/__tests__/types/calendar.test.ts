// laidOutEvent.test.ts
import { Appointment } from "@yosemite-crew/types";
import { LaidOutEvent } from "../../types/calendar";

describe("LaidOutEvent Types Definition", () => {
  // --- Section 1: Object Types Structure (Appointment + Layout Fields) ---
  describe("LaidOutEvent Structure", () => {
    it("creates a valid LaidOutEvent object with required Appointment fields and layout fields", () => {
      const now = new Date();

      const event: LaidOutEvent = {
        // --- Appointment required fields ---
        companion: {
          id: "comp-1",
          name: "Mochi",
          species: "Dog",
          breed: "Shiba Inu",
          parent: {
            id: "parent-1",
            name: "Alex",
          },
        },
        organisationId: "org-1",
        appointmentDate: now,
        startTime: now,
        timeSlot: "10:00",
        durationMinutes: 30,
        endTime: now,
        status: "UPCOMING",

        // --- Layout fields ---
        topPx: 120,
        heightPx: 60,
        columnIndex: 0,
        columnsCount: 2,
      };

      expect(event.status).toBe("UPCOMING");
      expect(event.startTime).toBeInstanceOf(Date);
      expect(event.topPx).toBe(120);
      expect(event.columnsCount).toBe(2);
    });

    it("creates a valid LaidOutEvent object with optional Appointment fields", () => {
      const now = new Date();

      const event: LaidOutEvent = {
        id: "appt-1",
        companion: {
          id: "comp-2",
          name: "Buddy",
          species: "Dog",
          parent: {
            id: "parent-2",
            name: "John Doe",
          },
        },
        lead: { id: "vet-1", name: "Dr. Smith", profileUrl: "https://example.com/dr-smith" },
        supportStaff: [{ id: "staff-1", name: "Nurse A" }],
        room: { id: "room-1", name: "Room 1" },
        appointmentType: {
          id: "type-1",
          name: "General Checkup",
          speciality: { id: "spec-1", name: "General" },
        },
        organisationId: "org-2",
        appointmentDate: now,
        startTime: now,
        timeSlot: "14:00",
        durationMinutes: 45,
        endTime: now,
        status: "CHECKED_IN",
        isEmergency: false,
        concern: "Vaccination",
        createdAt: now,
        updatedAt: now,
        attachments: [{ key: "k1", name: "report.pdf", contentType: "application/pdf" }],

        topPx: 200,
        heightPx: 90,
        columnIndex: 1,
        columnsCount: 3,
      };

      expect(event.id).toBe("appt-1");
      expect(event.lead?.name).toBe("Dr. Smith");
      expect(event.room?.name).toBe("Room 1");
      expect(event.appointmentType?.speciality.name).toBe("General");
      expect(event.attachments?.[0].name).toBe("report.pdf");
      expect(event.columnIndex).toBe(1);
      expect(event.status).toBe("CHECKED_IN");
    });
  });

  // --- Section 2: Relationship Validation (extends Appointment) ---
  describe("Relationship Validation", () => {
    it("allows assigning a LaidOutEvent to an Appointment", () => {
      const now = new Date();

      const laidOut: LaidOutEvent = {
        companion: {
          id: "comp-3",
          name: "Luna",
          species: "Cat",
          parent: {
            id: "parent-3",
            name: "Priya",
          },
        },
        organisationId: "org-3",
        appointmentDate: now,
        startTime: now,
        timeSlot: "09:30",
        durationMinutes: 20,
        endTime: now,
        status: "REQUESTED",
        topPx: 0,
        heightPx: 40,
        columnIndex: 0,
        columnsCount: 1,
      };

      const appointment: Appointment = laidOut;

      expect(appointment.status).toBe("REQUESTED");
      expect(appointment.companion.name).toBe("Luna");
    });
  });
});
