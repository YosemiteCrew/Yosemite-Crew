import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Documents from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Documents";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder }: any) => <div>{placeholder}</div>,
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel }: any) => <div>{inlabel}</div>,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button type="button">{text}</button>,
}));

describe("Documents", () => {
  it("renders categories and upload section", () => {
    render(<Documents />);

    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByText("Hygiene maintenance")).toBeInTheDocument();
    expect(screen.getByText("Upload records")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Sub-category")).toBeInTheDocument();
    expect(screen.getByText("Breed")).toBeInTheDocument();
  });
});
