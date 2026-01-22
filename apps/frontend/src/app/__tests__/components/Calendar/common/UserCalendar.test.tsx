import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import UserCalendar from "@/app/components/Calendar/common/UserCalendar";

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

const mockAppointmentsForUser = jest.fn();
jest.mock("@/app/components/Calendar/helpers", () => ({
  appointentsForUser: (...args: any[]) => mockAppointmentsForUser(...args),
}));

const userLabelsSpy = jest.fn();

jest.mock("@/app/components/Calendar/Task/UserLabels", () => (props: any) => {
  userLabelsSpy(props);
  return <div data-testid="user-labels" />;
});

const slotSpy = jest.fn();

jest.mock("@/app/components/Calendar/common/Slot", () => (props: any) => {
  slotSpy(props);
  return <div data-testid="slot" />;
});

jest.mock("@/app/components/Icons/Back", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      PrevDay
    </button>
  ),
}));

jest.mock("@/app/components/Icons/Next", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      NextDay
    </button>
  ),
}));

import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";

describe("UserCalendar (Appointments)", () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const setCurrentDate = jest.fn();

  const team = [
    { _id: "u1", name: "Alex" },
    { _id: "u2", name: "Sam" },
  ];

  const events: any[] = [
    { id: "a1", companion: { name: "Rex" } },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(team);
    mockAppointmentsForUser.mockReturnValue(events);
  });

  it("renders user labels and slots per team member", () => {
    render(
      <UserCalendar
        events={events}
        date={new Date("2025-01-06T00:00:00Z")}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(screen.getByTestId("user-labels")).toBeInTheDocument();
    expect(userLabelsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ team })
    );

    const slots = screen.getAllByTestId("slot");
    expect(slots).toHaveLength(team.length);

    expect(slotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        handleViewAppointment,
        handleRescheduleAppointment,
        height: 350,
      })
    );
  });

  it("updates current date on navigation", () => {
    render(
      <UserCalendar
        events={events}
        date={new Date("2025-01-06T00:00:00Z")}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    fireEvent.click(screen.getByText("PrevDay"));
    fireEvent.click(screen.getByText("NextDay"));

    const prevFn = setCurrentDate.mock.calls[0][0];
    const nextFn = setCurrentDate.mock.calls[1][0];

    expect(prevFn(new Date(2025, 0, 6)).getDate()).toBe(5);
    expect(nextFn(new Date(2025, 0, 6)).getDate()).toBe(7);
  });
});
