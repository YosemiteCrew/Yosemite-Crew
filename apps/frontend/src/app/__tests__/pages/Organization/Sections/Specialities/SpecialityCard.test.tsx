import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpecialityCard from "@/app/pages/Organization/Sections/Specialities/SpecialityCard";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children, onDeleteClick }: any) => (
    <div>
      <div>{title}</div>
      <button type="button" onClick={onDeleteClick}>
        Delete
      </button>
      <div>{children}</div>
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onSelect }: any) => (
    <button type="button" onClick={() => onSelect({ label: "Lead", key: "lead-1" })}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onChange }: any) => (
    <button type="button" onClick={() => onChange(["team-1"])}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} aria-label={inlabel} />
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/ServiceSearch/ServiceSearch", () => ({
  __esModule: true,
  default: () => <div>ServiceSearch</div>,
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [
    { _id: "team-1", name: "Dr. Who" },
  ],
}));

describe("SpecialityCard", () => {
  it("updates staff and services", () => {
    const setFormData = jest.fn();
    const speciality = {
      headUserId: "",
      teamMemberIds: [],
      services: [
        {
          name: "Checkup",
          description: "Initial",
          durationMinutes: 30,
          cost: 10,
          maxDiscount: 5,
        },
      ],
    } as any;

    render(
      <SpecialityCard setFormData={setFormData} speciality={speciality} index={0} />
    );

    fireEvent.click(screen.getByText("Select Lead"));
    fireEvent.click(screen.getByText("Assigned staff"));

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated" },
    });

    fireEvent.click(screen.getByText("Delete"));

    expect(setFormData).toHaveBeenCalled();
  });
});
