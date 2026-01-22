import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Details from "@/app/pages/Appointments/Sections/AppointmentInfo/Finance/Details";

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Accordion/Accordion", () => (props: any) => (
  <div>
    <div>{props.title}</div>
    <div>{props.children}</div>
  </div>
));

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text }: any) => <button type="button">{text}</button>,
}));

describe("Appointment finance details", () => {
  it("renders payment details and actions", () => {
    render(<Details />);

    expect(screen.getAllByText("Print invoice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Email invoice").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Payment ID/).length).toBeGreaterThan(0);
  });
});
