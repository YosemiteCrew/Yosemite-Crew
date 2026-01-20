import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import UserCalendar from "@/app/components/Calendar/common/UserCalendar";
import { Appointment } from "@yosemite-crew/types";

const useTeamForPrimaryOrgMock = jest.fn();

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => useTeamForPrimaryOrgMock(),
}));

const appointmentsForUserMock = jest.fn();

jest.mock("@/app/components/Calendar/helpers", () => ({
  appointentsForUser: (...args: any[]) => appointmentsForUserMock(...args),
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

describe("UserCalendar", () => {
  const setCurrentDate = jest.fn();
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const date = new Date(2025, 0, 2, 9);

  const team = [
    { _id: "team-1", name: "Alice" },
    { _id: "team-2", name: "Bob" },
  ];

  const events = [
    { lead: { name: "Alice" } } as Appointment,
    { lead: { name: "Bob" } } as Appointment,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useTeamForPrimaryOrgMock.mockReturnValue(team);
    appointmentsForUserMock.mockImplementation((allEvents: any[], user: any) =>
      allEvents.filter((ev) => ev.lead?.name === user.name)
    );
  });

  it("renders user labels and slots per team member", () => {
    render(
      <UserCalendar
        events={events}
        date={date}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
      />
    );

    expect(screen.getByTestId("user-labels")).toBeInTheDocument();
    expect(userLabelsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ team, currentDate: date })
    );

    expect(screen.getAllByTestId("slot")).toHaveLength(team.length);
    expect(slotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        handleViewAppointment,
        handleRescheduleAppointment,
        height: 350,
      })
    );
  });

  it("updates date when navigating", () => {
    render(
      <UserCalendar
        events={events}
        date={date}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
      />
    );

    fireEvent.click(screen.getByText("PrevDay"));
    fireEvent.click(screen.getByText("NextDay"));

    expect(setCurrentDate).toHaveBeenCalledTimes(2);
  });
});
