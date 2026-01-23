import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Summary from "@/app/pages/Appointments/Sections/AppointmentInfo/Finance/Summary";

const usePermissionsMock = jest.fn();

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => (props: any) => (
  <div>
    <div>{props.title}</div>
    <div data-testid="accordion-fields">{props.fields.length}</div>
  </div>
));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button type="button">{text}</button>,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt || ""} {...props} />,
}));

describe("Appointment finance summary", () => {
  const activeAppointment: any = {
    concern: "Checkup",
    appointmentType: { name: "General" },
    appointmentDate: "2025-01-06",
    startTime: "10:00",
    lead: { name: "Dr. Lee" },
    status: "requested",
  };

  const formData: any = {
    subTotal: "100.00",
    tax: "5.00",
    total: "105.00",
  };

  it("renders appointment details and payment summary", () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => false) });

    render(
      <Summary
        activeAppointment={activeAppointment}
        formData={formData}
        setFormData={jest.fn()}
      />
    );

    expect(screen.getByText("Appointments details")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
    expect(screen.getByText("$105.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay" })).not.toBeInTheDocument();
  });

  it("shows pay button when billing edit permission is granted", () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });

    render(
      <Summary
        activeAppointment={activeAppointment}
        formData={formData}
        setFormData={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Pay" })).toBeInTheDocument();
  });
});
