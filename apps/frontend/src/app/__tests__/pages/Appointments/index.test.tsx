import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ProtectedAppointments from "@/app/pages/Appointments";

const useAppointmentsMock = jest.fn();
const usePermissionsMock = jest.fn();
const useSearchStoreMock = jest.fn();

const calendarSpy = jest.fn();
const tableSpy = jest.fn();
const addAppointmentSpy = jest.fn();

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/hooks/useAppointments", () => ({
  useAppointmentsForPrimaryOrg: () => useAppointmentsMock(),
}));

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock("@/app/stores/searchStore", () => ({
  useSearchStore: (selector: any) => useSearchStoreMock(selector),
}));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/TitleCalendar", () => (props: any) => (
  <div>
    <button type="button" onClick={() => props.setActiveView("calendar")}
    >
      Calendar
    </button>
    <button type="button" onClick={() => props.setActiveView("list")}
    >
      List
    </button>
    <button type="button" onClick={() => props.setAddPopup(true)}>
      Add
    </button>
  </div>
));

jest.mock("@/app/components/Filters/Filters", () => () => (
  <div data-testid="filters" />
));

jest.mock("@/app/components/Calendar/AppointmentCalendar", () => (props: any) => {
  calendarSpy(props);
  return <div data-testid="appointment-calendar" />;
});

jest.mock("@/app/components/DataTable/Appointments", () => (props: any) => {
  tableSpy(props);
  return <div data-testid="appointments-table" />;
});

jest.mock("@/app/pages/Appointments/Sections/AddAppointment", () => (props: any) => {
  addAppointmentSpy(props);
  return props.showModal ? <div data-testid="add-appointment" /> : null;
});

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo", () => () => (
  <div data-testid="appointment-info" />
));

jest.mock("@/app/pages/Appointments/Sections/Reschedule", () => () => (
  <div data-testid="reschedule" />
));

describe("Appointments page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppointmentsMock.mockReturnValue([
      {
        id: "a1",
        status: "requested",
        isEmergency: true,
        companion: { name: "Buddy" },
      },
      {
        id: "a2",
        status: "completed",
        isEmergency: false,
        companion: { name: "Rex" },
      },
    ]);
    usePermissionsMock.mockReturnValue({
      can: jest.fn(() => true),
    });
    useSearchStoreMock.mockImplementation((selector: any) =>
      selector({ query: "buddy" })
    );
  });

  it("renders calendar view with filtered list and toggles to table", () => {
    render(<ProtectedAppointments />);

    expect(screen.getByTestId("appointment-calendar")).toBeInTheDocument();
    expect(calendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [
          expect.objectContaining({ id: "a1" }),
        ],
      })
    );

    fireEvent.click(screen.getByText("List"));
    expect(screen.getByTestId("appointments-table")).toBeInTheDocument();
    expect(tableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [
          expect.objectContaining({ id: "a1" }),
        ],
      })
    );
  });

  it("opens add appointment modal when add is clicked", () => {
    render(<ProtectedAppointments />);

    fireEvent.click(screen.getByText("Add"));
    expect(addAppointmentSpy).toHaveBeenCalledWith(
      expect.objectContaining({ showModal: true })
    );
  });
});
