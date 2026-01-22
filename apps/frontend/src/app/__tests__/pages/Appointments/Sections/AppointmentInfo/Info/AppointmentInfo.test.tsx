import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

import AppointmentInfo from "@/app/pages/Appointments/Sections/AppointmentInfo/Info/AppointmentInfo";

const useRoomsMock = jest.fn();
const useTeamMock = jest.fn();
const usePermissionsMock = jest.fn();
const updateAppointmentMock = jest.fn();
const accordionCalls: any[] = [];

jest.mock("@/app/hooks/useRooms", () => ({
  useRoomsForPrimaryOrg: () => useRoomsMock(),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock("@/app/services/appointmentService", () => ({
  updateAppointment: (...args: any[]) => updateAppointmentMock(...args),
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => (props: any) => {
  accordionCalls.push(props);
  return <div data-testid={`accordion-${props.title}`} />;
});

describe("AppointmentInfo section", () => {
  const activeAppointment: any = {
    id: "appt-1",
    concern: "Checkup",
    room: { id: "room-1", name: "Room A" },
    appointmentType: { name: "General" },
    appointmentDate: "2025-01-06",
    startTime: "10:00",
    status: "requested",
    lead: { id: "team-1", name: "Alex" },
    supportStaff: [{ id: "team-2", name: "Sam" }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accordionCalls.length = 0;
    useRoomsMock.mockReturnValue([{ id: "room-1", name: "Room A" }]);
    useTeamMock.mockReturnValue([
      { _id: "team-1", name: "Alex" },
      { _id: "team-2", name: "Sam" },
    ]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
  });

  it("calls updateAppointment when saving appointment fields", async () => {
    render(<AppointmentInfo activeAppointment={activeAppointment} />);

    const appointmentAccordion = accordionCalls.find(
      (item) => item.title === "Appointments details"
    );
    await appointmentAccordion.onSave({
      concern: "Updated",
      room: "room-1",
      status: "completed",
    });

    expect(updateAppointmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        concern: "Updated",
        room: { id: "room-1", name: "Room A" },
        status: "completed",
      })
    );
  });

  it("calls updateAppointment when saving staff fields", async () => {
    render(<AppointmentInfo activeAppointment={activeAppointment} />);

    const staffAccordion = accordionCalls.find(
      (item) => item.title === "Staff details"
    );
    await staffAccordion.onSave({ staff: ["team-2"] });

    expect(updateAppointmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supportStaff: [{ id: "team-2", name: "Sam" }],
      })
    );
  });
});
