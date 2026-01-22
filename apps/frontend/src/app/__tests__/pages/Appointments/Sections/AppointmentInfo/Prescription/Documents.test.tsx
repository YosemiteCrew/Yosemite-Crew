import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Documents from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Documents";

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Accordion/Accordion", () => (props: any) => (
  <div>
    <div>{props.title}</div>
    <div>{props.children}</div>
  </div>
));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => (props: any) => (
  <div>{props.placeholder}</div>
));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => (props: any) => (
  <input aria-label={props.inlabel} />
));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button type="button">{text}</button>,
}));

describe("Appointment documents", () => {
  it("renders categories and upload section", () => {
    render(<Documents />);

    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByText("Hygiene maintenance")).toBeInTheDocument();
    expect(screen.getByText("Upload records")).toBeInTheDocument();
    expect(screen.getByLabelText("Breed")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });
});
