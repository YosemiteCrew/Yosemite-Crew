import { LaidOutEvent } from "@/app/types/calendar";

describe("Calendar Types", () => {
  it("should verify LaidOutEvent correctly extends AppointmentsProps with layout fields", () => {
    // Create an object that strictly adheres to LaidOutEvent
    // to verify the type intersection (AppointmentsProps & Layout fields)
    const mockEvent: LaidOutEvent = {
      // -- Inherited from AppointmentsProps --
      name: "Rex",
      parentName: "Jane Doe",
      image: "http://example.com/rex.png",
      reason: "Dental Cleaning",
      emergency: false,
      service: "Dental",
      room: "Room A",
      time: "14:00",
      date: "2023-11-15",
      lead: "Dr. Brown",
      leadDepartment: "Dental Surgery",
      support: ["Tech Sarah"],
      status: "Confirmed" as any, // Cast if exact string literal isn't imported from status enum
      breed: "German Shepherd",
      species: "Dog",
      start: new Date("2023-11-15T14:00:00Z"),
      end: new Date("2023-11-15T15:00:00Z"),

      // -- LaidOutEvent Specific Fields --
      topPx: 150,
      heightPx: 60,
      columnIndex: 1,
      columnsCount: 3,
    };

    // Assertions to verify value assignments
    expect(mockEvent).toBeDefined();

    // Verify Layout Props
    expect(mockEvent.topPx).toBe(150);
    expect(mockEvent.heightPx).toBe(60);
    expect(mockEvent.columnIndex).toBe(1);
    expect(mockEvent.columnsCount).toBe(3);

    // Verify Inherited Props
    expect(mockEvent.name).toBe("Rex");
    expect(mockEvent.start).toBeInstanceOf(Date);
  });
});