/* eslint-disable @next/next/no-img-element */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Summary from "@/app/pages/Appointments/Sections/AppointmentInfo/Finance/Summary";

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <div>{text}</div>,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

describe("Appointment Finance Summary", () => {
  it("renders totals and payment section", () => {
    render(
      <Summary
        activeAppointment={{
          concern: "Checkup",
          appointmentType: { name: "Exam" },
          appointmentDate: new Date("2024-01-01"),
          startTime: new Date("2024-01-01"),
          lead: { name: "Dr. Lee" },
          status: "requested",
        } as any}
        formData={{
          subjective: [],
          objective: [],
          assessment: [],
          discharge: [],
          plan: [],
          total: "100.00",
          subTotal: "90.00",
          tax: "10.00",
        }}
        setFormData={jest.fn()}
      />
    );

    expect(screen.getByText("Appointments details")).toBeInTheDocument();
    expect(screen.getByText("$90.00")).toBeInTheDocument();
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getAllByText("Pay").length).toBeGreaterThan(0);
  });
});
