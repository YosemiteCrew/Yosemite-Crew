import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppointmentsPage from "@/app/pages/Appointments";

const useAppointmentsMock = jest.fn();

jest.mock("@/app/hooks/useAppointments", () => ({
  useAppointmentsForPrimaryOrg: () => useAppointmentsMock(),
}));

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected">{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

jest.mock("@/app/components/TitleCalendar", () => ({
  __esModule: true,
  default: ({ setActiveView }: any) => (
    <button type="button" onClick={() => setActiveView("list")}
    >
      switch-list
    </button>
  ),
}));

jest.mock("@/app/components/Filters/AppointmentFilters", () => ({
  __esModule: true,
  default: () => <div>filters</div>,
}));

jest.mock("@/app/components/DataTable/Appointments", () => ({
  __esModule: true,
  default: () => <div>appointments-table</div>,
}));

jest.mock("@/app/components/Calendar/AppointmentCalendar", () => ({
  __esModule: true,
  default: () => <div>calendar</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AddAppointment", () => ({
  __esModule: true,
  default: () => <div>add-appointment</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo", () => ({
  __esModule: true,
  default: () => <div>appointment-info</div>,
}));

describe("Appointments page", () => {
  it("renders list view when toggled", () => {
    useAppointmentsMock.mockReturnValue([
      { id: "1", companion: { name: "Buddy" } },
    ]);

    render(<AppointmentsPage />);

    expect(screen.getByTestId("protected")).toBeInTheDocument();
    expect(screen.getByText("calendar")).toBeInTheDocument();

    fireEvent.click(screen.getByText("switch-list"));
    expect(screen.getByText("appointments-table")).toBeInTheDocument();
  });
});
