/* eslint-disable @next/next/no-img-element */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DayCalendar from "@/app/components/Calendar/common/DayCalendar";
import { Appointment } from "@yosemite-crew/types";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: () => ({}),
}));

jest.mock("@/app/utils/urls", () => ({
  getSafeImageUrl: () => "/img.png",
}));

jest.mock("@/app/utils/appointments", () => ({
  allowReschedule: () => true,
}));

jest.mock("@/app/components/Calendar/common/TimeLabels", () => () => (
  <div data-testid="time-labels" />
));

jest.mock("@/app/components/Calendar/common/HorizontalLines", () => () => (
  <div data-testid="horizontal-lines" />
));

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

describe("DayCalendar", () => {
  const baseDate = new Date(2025, 0, 2, 9);
  const setCurrentDate = jest.fn();
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();

  const allDayEvent = {
    status: "CHECKED_IN",
    startTime: new Date(2025, 0, 2, 0, 0, 0),
    endTime: new Date(2025, 0, 3, 0, 0, 0),
    companion: {
      name: "Buddy",
      species: "DOG",
      id: "buddy",
      parent: { name: "Alex", id: "alex" },
    },
    concern: "Checkup",
    lead: { name: "Dr. Lee", id: "dr lee" },
    appointmentDate: new Date(),
    organisationId: "org1",
    durationMinutes: 60,
    timeSlot: "10:30PM",
  } as Appointment;

  const timedEvent = {
    status: "CHECKED_IN",
    startTime: new Date(2025, 0, 2, 10, 0, 0),
    endTime: new Date(2025, 0, 2, 11, 0, 0),
    companion: {
      name: "Milo",
      id: "milo",
      species: "CAT",
      parent: { name: "Sam", id: "sam" },
    },
    concern: "Grooming",
    lead: { name: "Dr. Ray", id: "dr. ray" },
    appointmentDate: new Date(),
    organisationId: "org1",
    durationMinutes: 60,
    timeSlot: "10:30PM",
  } as Appointment;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore?.();
    (console.warn as jest.Mock).mockRestore?.();
  });

  it("renders all-day events and triggers view handler", () => {
    render(
      <DayCalendar
        events={[allDayEvent, timedEvent]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
      />
    );

    expect(screen.getByText("All-day")).toBeInTheDocument();

    const allDayButton = screen.getByText("Buddy").closest("button");
    expect(allDayButton).toBeInTheDocument();
    fireEvent.click(allDayButton as HTMLElement);
    expect(handleViewAppointment).toHaveBeenCalledWith(allDayEvent);
  });

  it("triggers reschedule handler for timed events", () => {
    render(
      <DayCalendar
        events={[timedEvent]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
      />
    );

    const rescheduleButton = screen
      .getAllByRole("button")
      .find((btn) => btn.className.includes("hover:shadow"));

    expect(rescheduleButton).toBeTruthy();
    fireEvent.click(rescheduleButton as HTMLElement);

    expect(handleRescheduleAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        companion: timedEvent.companion,
        concern: timedEvent.concern,
        lead: timedEvent.lead,
        startTime: timedEvent.startTime,
        endTime: timedEvent.endTime,
        status: timedEvent.status,
      })
    );
  });

  it("updates date when navigating", () => {
    render(
      <DayCalendar
        events={[]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
      />
    );

    fireEvent.click(screen.getByText("PrevDay"));
    fireEvent.click(screen.getByText("NextDay"));

    const prevFn = setCurrentDate.mock.calls[0][0];
    const nextFn = setCurrentDate.mock.calls[1][0];

    const prev = prevFn(baseDate);
    const next = nextFn(baseDate);

    expect(prev.getDate()).toBe(1);
    expect(next.getDate()).toBe(3);
  });
});
