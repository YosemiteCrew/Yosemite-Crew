import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Details from "@/app/pages/Appointments/Sections/AppointmentInfo/Finance/Details";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text }: any) => <div>{text}</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Finance/demo", () => ({
  DemoPayments: [
    {
      appointmentId: "appt-1",
      paymentId: "pay-1",
      mode: "Card",
      date: "2024-01-01",
      time: "10:00",
      status: "Paid",
      amount: "100",
    },
  ],
}));

describe("Appointment Finance Details", () => {
  it("renders payment details", () => {
    render(<Details />);

    expect(screen.getAllByText("pay-1").length).toBeGreaterThan(0);
    expect(screen.getByText("appt-1")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(screen.getByText("Print invoice")).toBeInTheDocument();
    expect(screen.getByText("Email invoice")).toBeInTheDocument();
  });
});
