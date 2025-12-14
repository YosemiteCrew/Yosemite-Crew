import { AppointmentsProps, Status } from "@/app/types/appointments";

describe("Appointments Types", () => {
  it("should verify Status union type compatibility", () => {
    // We explicitly define an array of the Status type to ensure
    // the string literals match the exported definition.
    const statuses: Status[] = [
      "Requested",
      "Upcoming",
      "Checked-in",
      "In-progress",
      "Completed",
      "Cancelled",
      "Post-care",
    ];

    expect(statuses).toBeDefined();
    expect(statuses.length).toBe(7);
    expect(statuses).toContain("Requested");
    expect(statuses).toContain("Post-care");
  });

  it("should verify AppointmentsProps object structure", () => {
    // We construct an object that strictly adheres to AppointmentsProps
    // to ensure the type definition accepts the expected shape.
    const mockAppointment: AppointmentsProps = {
      name: "Buddy",
      parentName: "John Doe",
      image: "https://example.com/buddy.jpg",
      reason: "Annual Checkup",
      emergency: false,
      service: "General",
      room: "Examination Room 1",
      time: "10:00 AM",
      date: "2023-12-25",
      lead: "Dr. Smith",
      leadDepartment: "General Medicine",
      support: ["Nurse Joy", "Assistant Lee"],
      status: "Upcoming", // Uses the Status type
      breed: "Golden Retriever",
      species: "Canine",
      start: new Date("2023-12-25T10:00:00Z"),
      end: new Date("2023-12-25T11:00:00Z"),
    };

    expect(mockAppointment).toBeDefined();
    expect(mockAppointment.name).toBe("Buddy");
    expect(mockAppointment.status).toBe("Upcoming");
    expect(mockAppointment.emergency).toBe(false);
    expect(mockAppointment.start).toBeInstanceOf(Date);
    expect(Array.isArray(mockAppointment.support)).toBe(true);
  });
});