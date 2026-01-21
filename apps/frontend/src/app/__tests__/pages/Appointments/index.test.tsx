import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Appointments from "@/app/pages/Appointments";
import { Appointment } from "@yosemite-crew/types";

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

const useAppointmentsMock = jest.fn();

jest.mock("@/app/hooks/useAppointments", () => ({
  useAppointmentsForPrimaryOrg: () => useAppointmentsMock(),
}));

jest.mock("@/app/stores/searchStore", () => ({
  useSearchStore: (selector: any) => selector({ query: "" }),
}));

const titleCalendarSpy = jest.fn();

jest.mock("@/app/components/TitleCalendar", () => ({
  __esModule: true,
  default: (props: any) => {
    titleCalendarSpy(props);
    return (
      <button type="button" onClick={() => props.setActiveView("table")}
        >
        SwitchView
      </button>
    );
  },
}));

const filtersSpy = jest.fn();

jest.mock("@/app/components/Filters/Filters", () => ({
  __esModule: true,
  default: (props: any) => {
    filtersSpy(props);
    return <div data-testid="filters" />;
  },
}));

const calendarSpy = jest.fn();

jest.mock("@/app/components/Calendar/AppointmentCalendar", () => ({
  __esModule: true,
  default: (props: any) => {
    calendarSpy(props);
    return <div data-testid="calendar" />;
  },
}));

jest.mock("@/app/components/DataTable/Appointments", () => ({
  __esModule: true,
  default: () => <div data-testid="table" />,
}));

jest.mock("@/app/pages/Appointments/Sections/AddAppointment", () => ({
  __esModule: true,
  default: () => <div data-testid="add-appointment" />,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo", () => ({
  __esModule: true,
  default: () => <div data-testid="appointment-info" />,
}));

jest.mock("@/app/pages/Appointments/Sections/Reschedule", () => ({
  __esModule: true,
  default: () => <div data-testid="reschedule" />,
}));

describe("Appointments page", () => {
  const appointments: Appointment[] = [
    {
      id: "appt-1",
      companion: { name: "Buddy" },
      status: "CHECKED_IN",
      isEmergency: false,
    } as Appointment,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useAppointmentsMock.mockReturnValue(appointments);
  });

  it("renders calendar view by default and switches to table", () => {
    render(<Appointments />);

    expect(screen.getByTestId("calendar")).toBeInTheDocument();
    expect(calendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({ filteredList: appointments })
    );

    fireEvent.click(screen.getByText("SwitchView"));
    expect(screen.getByTestId("table")).toBeInTheDocument();
  });
});
