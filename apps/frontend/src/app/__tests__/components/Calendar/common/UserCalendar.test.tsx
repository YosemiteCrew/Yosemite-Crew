import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import UserCalendar from "@/app/components/Calendar/common/UserCalendar";
import { Appointment } from "@yosemite-crew/types";

// ---- Mocks ----

const mockUseTeamForPrimaryOrg = jest.fn();
jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => mockUseTeamForPrimaryOrg(),
}));

const mockAppointmentsForUser = jest.fn();
jest.mock("@/app/components/Calendar/helpers", () => ({
  appointentsForUser: (...args: any[]) => mockAppointmentsForUser(...args),
}));

// UserLabels: simple render so we can assert it is present and gets props
const userLabelsSpy = jest.fn();
jest.mock("@/app/components/Calendar/Task/UserLabels", () => {
  return (props: any) => {
    userLabelsSpy(props);
    return <div data-testid="user-labels">UserLabels</div>;
  };
});

// Slot: simple render + spy props
const slotSpy = jest.fn();
jest.mock("@/app/components/Calendar/common/Slot", () => {
  return (props: any) => {
    slotSpy(props);
    return <div data-testid="slot">Slot {props.dayIndex}</div>;
  };
});

// Icons: clickable buttons
jest.mock("react-icons/gr", () => ({
  GrNext: (props: any) => (
    <button data-testid="next-day" onClick={props.onClick}>
      next
    </button>
  ),
  GrPrevious: (props: any) => (
    <button data-testid="prev-day" onClick={props.onClick}>
      prev
    </button>
  ),
}));

describe("UserCalendar", () => {
  const mockSetCurrentDate = jest.fn();
  const mockHandleViewAppointment = jest.fn();

  const date = new Date("2025-01-06T12:00:00.000Z");

  const team = [
    { _id: "u-1", name: "Alice" },
    { _id: "u-2", name: "Bob" },
    { _id: "u-3", name: "Cara" },
  ] as any[];

  const events: Appointment[] = [
    { _id: "a-1", companion: { name: "Buddy" } } as any,
    { _id: "a-2", companion: { name: "Rex" } } as any,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTeamForPrimaryOrg.mockReturnValue(team);

    // Return a distinct array per user so we can assert mapping
    mockAppointmentsForUser.mockImplementation((evs: Appointment[], user: any) => {
      return evs.filter((e) => String(e.id).endsWith(user._id.slice(-1)));
    });
  });

  const renderCal = () =>
    render(
      <UserCalendar
        events={events}
        date={date}
        handleViewAppointment={mockHandleViewAppointment}
        setCurrentDate={mockSetCurrentDate}
      />
    );

  it("renders UserLabels with team and currentDate props", () => {
    renderCal();

    expect(screen.getByTestId("user-labels")).toBeInTheDocument();
    expect(userLabelsSpy).toHaveBeenCalled();

    const props = userLabelsSpy.mock.calls[0][0];
    expect(props.team).toBe(team);
    expect(props.currentDate).toBe(date);
  });

  it("renders one Slot per team member and passes correct props", () => {
    renderCal();

    const slots = screen.getAllByTestId("slot");
    expect(slots).toHaveLength(team.length);

    expect(slotSpy).toHaveBeenCalledTimes(team.length);

    // Validate each slot call
    team.forEach((user, index) => {
      const callProps = slotSpy.mock.calls[index][0];
      expect(callProps).toEqual(
        expect.objectContaining({
          height: 300,
          dayIndex: index,
          handleViewAppointment: mockHandleViewAppointment,
          length: team.length - 1,
        })
      );

      // ensure the helper is called for each user
      expect(mockAppointmentsForUser).toHaveBeenCalledWith(events, user);
      // and result is passed into slotEvents
      expect(Array.isArray(callProps.slotEvents)).toBe(true);
    });
  });

  it("clicking next-day updates current date by +1 day", () => {
    renderCal();

    fireEvent.click(screen.getByTestId("next-day"));

    expect(mockSetCurrentDate).toHaveBeenCalledTimes(1);
    const updater = mockSetCurrentDate.mock.calls[0][0];
    expect(typeof updater).toBe("function");

    const prev = new Date("2025-01-06T00:00:00.000Z");
    const next = updater(prev);

    expect(next).toBeInstanceOf(Date);
    expect(next.getFullYear()).toBe(2025);
    expect(next.getMonth()).toBe(0); // Jan
    expect(next.getDate()).toBe(7);
  });

  it("clicking prev-day updates current date by -1 day", () => {
    renderCal();

    fireEvent.click(screen.getByTestId("prev-day"));

    expect(mockSetCurrentDate).toHaveBeenCalledTimes(1);
    const updater = mockSetCurrentDate.mock.calls[0][0];
    expect(typeof updater).toBe("function");

    const prev = new Date("2025-01-06T00:00:00.000Z");
    const next = updater(prev);

    expect(next).toBeInstanceOf(Date);
    expect(next.getFullYear()).toBe(2025);
    expect(next.getMonth()).toBe(0); // Jan
    expect(next.getDate()).toBe(5);
  });

  it("handles undefined team safely (renders without crashing and no Slot)", () => {
    mockUseTeamForPrimaryOrg.mockReturnValue(undefined);

    render(
      <UserCalendar
        events={events}
        date={date}
        handleViewAppointment={mockHandleViewAppointment}
        setCurrentDate={mockSetCurrentDate}
      />
    );

    // UserLabels still renders (team prop is undefined)
    expect(screen.getByTestId("user-labels")).toBeInTheDocument();

    // No slots because team?.map
    expect(screen.queryByTestId("slot")).not.toBeInTheDocument();
  });
});
