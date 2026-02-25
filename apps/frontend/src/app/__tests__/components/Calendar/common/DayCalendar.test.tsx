/* eslint-disable @next/next/no-img-element */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import DayCalendar from "@/app/features/appointments/components/Calendar/common/DayCalendar";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt || ""} {...props} />,
}));

const mockGetDayWindow = jest.fn((_events: any[]) => ({
  windowStart: 0,
  windowEnd: 120,
}));
const mockGetTotalWindowHeightPx = jest.fn((_start: number, _end: number) => 200);
const mockIsAllDayForDate = jest.fn();
const mockLayoutDayEvents = jest.fn();

jest.mock("@/app/features/appointments/components/Calendar/helpers", () => ({
  EVENT_HORIZONTAL_GAP_PX: 4,
  EVENT_VERTICAL_GAP_PX: 2,
  getDayWindow: (events: any[]) => mockGetDayWindow(events),
  getTotalWindowHeightPx: (start: number, end: number) =>
    mockGetTotalWindowHeightPx(start, end),
  isAllDayForDate: (...args: any[]) => mockIsAllDayForDate(...args),
  layoutDayEvents: (...args: any[]) => mockLayoutDayEvents(...args),
}));

jest.mock("@/app/features/appointments/components/Calendar/common/TimeLabels", () => () => (
  <div data-testid="time-labels" />
));

jest.mock("@/app/features/appointments/components/Calendar/common/HorizontalLines", () => () => (
  <div data-testid="horizontal-lines" />
));

jest.mock("@/app/ui/tables/Appointments", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "purple", color: "white" })),
}));

jest.mock("@/app/lib/appointments", () => ({
  allowReschedule: jest.fn(() => true),
}));

jest.mock("@/app/lib/urls", () => ({
  getSafeImageUrl: jest.fn(() => "image"),
}));

jest.mock("@/app/ui/primitives/Icons/Back", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Prev
    </button>
  ),
}));

jest.mock("@/app/ui/primitives/Icons/Next", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Next
    </button>
  ),
}));

jest.mock("react-icons/io", () => ({
  IoIosCalendar: () => <span>reschedule</span>,
}));

jest.mock("react-icons/io5", () => ({
  IoEyeOutline: () => <span>view</span>,
  IoCalendarOutline: () => <span>reschedule</span>,
  IoDocumentTextOutline: () => <span>soap</span>,
  IoCardOutline: () => <span>finance</span>,
}));

jest.mock("react-icons/md", () => ({
  MdOutlineAutorenew: () => <span>change-status</span>,
}));

describe("DayCalendar (Appointments)", () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const setCurrentDate = jest.fn();
  const originalConsoleError = console.error;

  const baseDate = new Date("2025-01-06T10:00:00Z");

  const allDayEvent: any = {
    id: "all-day",
    status: "completed",
    startTime: new Date("2025-01-06T00:00:00Z"),
    companion: {
      name: "Buddy",
      species: "dog",
      parent: { name: "Sam" },
    },
    concern: "Checkup",
  };

  const timedEvent: any = {
    id: "timed",
    status: "in_progress",
    startTime: new Date("2025-01-06T09:00:00Z"),
    endTime: new Date("2025-01-06T10:00:00Z"),
    appointmentType: { id: "service-1", name: "Grooming" },
    companion: {
      name: "Rex",
      species: "dog",
      parent: { name: "Alex" },
    },
    concern: "Grooming",
    lead: { name: "Dr. Lee" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAllDayForDate.mockImplementation((event: any) => event.id === "all-day");
    mockLayoutDayEvents.mockReturnValue([
      {
        ...timedEvent,
        topPx: 10,
        heightPx: 80,
        columnIndex: 0,
        columnsCount: 1,
      },
    ]);
  });

  it("renders all-day events and triggers view handler", () => {
    render(
      <DayCalendar
        events={[allDayEvent, timedEvent]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments={false}
      />
    );

    expect(screen.getByText("All-day")).toBeInTheDocument();
    const allDayButton = screen.getByText("Buddy").closest("button");
    expect(allDayButton).toBeInTheDocument();

    fireEvent.click(allDayButton!);
    expect(handleViewAppointment).toHaveBeenCalledWith(allDayEvent);
  });

  it("renders timed events and handles reschedule clicks", () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation((message: any, ...args: any[]) => {
        const text =
          typeof message === "string" ? message : message?.message || "";
        if (
          text.includes("concurrent rendering") ||
          text.includes("validateDOMNesting")
        ) {
          return;
        }
        originalConsoleError(message, ...args);
      });

    render(
      <DayCalendar
        events={[timedEvent]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    const eventButton = screen.getByRole("button", { name: /Rex/i });
    fireEvent.mouseEnter(eventButton);

    expect(screen.getByText("Service:")).toBeInTheDocument();
    expect(screen.getAllByText("Grooming").length).toBeGreaterThan(0);
    expect(screen.getByText("Lead:")).toBeInTheDocument();
    expect(screen.getByText("Dr. Lee")).toBeInTheDocument();

    const rescheduleButton = screen.getByTitle(/reschedule/i);
    fireEvent.click(rescheduleButton);

    expect(handleRescheduleAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: "timed" })
    );
    expect(handleViewAppointment).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("updates current date with navigation", () => {
    render(
      <DayCalendar
        events={[]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments={false}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Prev"));

    const nextFn = setCurrentDate.mock.calls[0][0];
    const prevFn = setCurrentDate.mock.calls[1][0];

    expect(nextFn(new Date(2025, 0, 6)).getDate()).toBe(7);
    expect(prevFn(new Date(2025, 0, 6)).getDate()).toBe(5);
  });
});
