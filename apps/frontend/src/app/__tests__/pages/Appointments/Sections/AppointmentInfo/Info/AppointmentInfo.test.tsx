import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// Import Path: Go up 6 levels to 'src/app', then down to 'pages'
import AppointmentInfo from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Info/AppointmentInfo";
import { useRoomsForPrimaryOrg } from "@/app/hooks/useRooms";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { updateAppointment } from "@/app/services/appointmentService";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

jest.mock("@/app/hooks/useRooms");
jest.mock("@/app/hooks/useTeam");
jest.mock("@/app/services/appointmentService");

// Flexible Mock for EditableAccordion
jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, data, fields, onSave }: any) => (
    <div data-testid={`accordion-${title}`}>
      <div data-testid={`data-${title}`}>{JSON.stringify(data)}</div>
      <div data-testid={`fields-${title}`}>{JSON.stringify(fields)}</div>

      <button
        data-testid={`save-${title}`}
        onClick={(e: any) => {
          // Read from dataset.value which maps to data-value attribute
          const value = e.target.dataset.value
            ? JSON.parse(e.target.dataset.value)
            : {};
          onSave(value);
        }}
      >
        Trigger Save
      </button>
    </div>
  ),
}));

describe("AppointmentInfo Section", () => {
  const mockRooms = [
    { id: "room-1", name: "Exam Room 1" },
    { id: "room-2", name: "Surgery A" },
  ];
  const mockTeams = [
    { _id: "team-1", name: "Dr. Smith" },
    { _id: "team-2", name: "Nurse Joy" },
  ];
  const mockActiveAppointment: Appointment = {
    id: "appt-1",
    concern: "Fever",
    room: { id: "room-1", name: "Exam Room 1" },
    appointmentType: { id: "s1", name: "Checkup" },
    appointmentDate: new Date("2025-01-01"),
    startTime: new Date("2025-01-01T10:00:00Z"),
    status: "Checked-In",
    lead: { id: "team-1", name: "Dr. Smith" },
    supportStaff: [{ id: "team-2", name: "Nurse Joy" }],
  } as unknown as Appointment;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue(mockRooms);
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
  });

  // --- Section 1: Rendering & Structure ---

  it("renders both accordions successfully", () => {
    render(<AppointmentInfo activeAppointment={mockActiveAppointment} />);
    expect(
      screen.getByTestId("accordion-Appointments details")
    ).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Staff details")).toBeInTheDocument();
  });

  // --- Section 2: Data Mapping & Options ---

  it("correctly maps activeAppointment data to Appointment fields", () => {
    render(<AppointmentInfo activeAppointment={mockActiveAppointment} />);
    const dataEl = screen.getByTestId("data-Appointments details");
    const mappedData = JSON.parse(dataEl.textContent || "{}");
    expect(mappedData).toEqual(
      expect.objectContaining({
        concern: "Fever",
        room: "room-1",
        service: "Checkup",
        status: "Checked-In",
      })
    );
  });

  it("correctly maps room options into the fields config", () => {
    render(<AppointmentInfo activeAppointment={mockActiveAppointment} />);
    const fieldsEl = screen.getByTestId("fields-Appointments details");
    const fields = JSON.parse(fieldsEl.textContent || "[]");
    const roomField = fields.find((f: any) => f.key === "room");
    expect(roomField).toBeDefined();
    expect(roomField.options).toEqual([
      { label: "Exam Room 1", value: "room-1" },
      { label: "Surgery A", value: "room-2" },
    ]);
  });

  it("correctly maps staff data and team options", () => {
    render(<AppointmentInfo activeAppointment={mockActiveAppointment} />);
    const dataEl = screen.getByTestId("data-Staff details");
    const mappedData = JSON.parse(dataEl.textContent || "{}");
    expect(mappedData.staff).toEqual(["Nurse Joy"]);
    expect(mappedData.lead).toBe("Dr. Smith");

    const fieldsEl = screen.getByTestId("fields-Staff details");
    const fields = JSON.parse(fieldsEl.textContent || "[]");
    const staffField = fields.find((f: any) => f.key === "staff");
    expect(staffField.options).toEqual([
      { label: "Dr. Smith", value: "team-1" },
      { label: "Nurse Joy", value: "team-2" },
    ]);
  });

  // --- Section 3: Interaction & Updates (Logic Verification) ---

  it("updates appointment details with correct room lookup", async () => {
    render(<AppointmentInfo activeAppointment={mockActiveAppointment} />);

    const newValues = {
      concern: "High Fever",
      room: "room-2",
    };

    const saveBtn = screen.getByTestId("save-Appointments details");

    // Fix: Use dataset property assignment instead of setAttribute to satisfy SonarQube
    saveBtn.dataset.value = JSON.stringify(newValues);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateAppointment).toHaveBeenCalledTimes(1);
    });

    const expectedPayload = {
      ...mockActiveAppointment,
      concern: "High Fever",
      room: { id: "room-2", name: "Surgery A" },
    };
    expect(updateAppointment).toHaveBeenCalledWith(expectedPayload);
  });

  it("handles appointment update with invalid room ID (edge case)", async () => {
    render(<AppointmentInfo activeAppointment={mockActiveAppointment} />);

    const newValues = {
      concern: "New",
      room: "room-999",
    };

    const saveBtn = screen.getByTestId("save-Appointments details");
    saveBtn.dataset.value = JSON.stringify(newValues);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateAppointment).toHaveBeenCalled();
    });

    const payload = (updateAppointment as jest.Mock).mock.calls[0][0];
    expect(payload.room).toBeUndefined();
  });

  it("updates staff details by mapping IDs back to team objects", async () => {
    render(<AppointmentInfo activeAppointment={mockActiveAppointment} />);

    const newValues = {
      staff: ["team-1", "team-2"],
    };

    const saveBtn = screen.getByTestId("save-Staff details");
    saveBtn.dataset.value = JSON.stringify(newValues);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateAppointment).toHaveBeenCalledTimes(1);
    });

    const payload = (updateAppointment as jest.Mock).mock.calls[0][0];
    expect(payload.supportStaff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "team-1" }),
        expect.objectContaining({ id: "team-2" }),
      ])
    );
  });

  it("handles clearing staff selection (empty array)", async () => {
    render(<AppointmentInfo activeAppointment={mockActiveAppointment} />);

    const saveBtn = screen.getByTestId("save-Staff details");
    saveBtn.dataset.value = JSON.stringify({ staff: [] });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateAppointment).toHaveBeenCalled();
    });

    const payload = (updateAppointment as jest.Mock).mock.calls[0][0];
    expect(payload.supportStaff).toEqual([]);
  });

  // --- Section 4: Edge Cases & Error Handling ---

  it("handles update failures gracefully (console log)", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (updateAppointment as jest.Mock).mockRejectedValue(
      new Error("Update failed")
    );

    render(<AppointmentInfo activeAppointment={mockActiveAppointment} />);

    const saveBtn = screen.getByTestId("save-Appointments details");
    saveBtn.dataset.value = JSON.stringify({ room: "room-1" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateAppointment).toHaveBeenCalled();
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    consoleSpy.mockRestore();
  });

  it("handles staff update failures gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (updateAppointment as jest.Mock).mockRejectedValue(
      new Error("Staff Update failed")
    );

    render(<AppointmentInfo activeAppointment={mockActiveAppointment} />);

    const saveBtn = screen.getByTestId("save-Staff details");
    saveBtn.dataset.value = JSON.stringify({ staff: [] });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it("handles missing optional fields in activeAppointment", () => {
    const emptyAppt = {
      ...mockActiveAppointment,
      concern: undefined,
      room: undefined,
      appointmentType: undefined,
      appointmentDate: undefined,
      startTime: undefined,
      status: undefined,
      lead: undefined,
      supportStaff: undefined,
    } as unknown as Appointment;

    render(<AppointmentInfo activeAppointment={emptyAppt} />);

    const dataEl = screen.getByTestId("data-Appointments details");
    const data = JSON.parse(dataEl.textContent || "{}");

    expect(data.concern).toBe("");
    expect(data.room).toBe("");
    expect(data.service).toBe("");
  });
});
