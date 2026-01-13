import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Documents from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Documents";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options = [], onSelect }: any) => (
    <div>
      <span>{placeholder}</span>
      {options.map((option: any) => (
        <button
          key={`${placeholder}-${option.key}`}
          type="button"
          onClick={() => onSelect(option)}
        >
          {placeholder}: {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value ?? ""} onChange={onChange} />
    </label>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button type="button">{text}</button>,
}));

describe("AppointmentInfo Documents", () => {
  it("renders categories and upload section", () => {
    render(<Documents />);

    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByText("Hygiene maintenance")).toBeInTheDocument();
    expect(screen.getByText("Upload records")).toBeInTheDocument();
  });

  it("updates sub-category options when category changes", () => {
    render(<Documents />);

    fireEvent.click(screen.getByText("Category: Health"));

    expect(
      screen.getByText("Sub-category: Hospital visits")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Category: Hygiene maintenance"));
    expect(
      screen.getByText("Sub-category: Grooming visits")
    ).toBeInTheDocument();
  });
});
