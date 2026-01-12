import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import SpecialityCard from "@/app/pages/Organization/Sections/Specialities/SpecialityCard";
import { SpecialityWeb } from "@/app/types/speciality";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children, onDeleteClick }: any) => (
    <section>
      <h3>{title}</h3>
      <button type="button" onClick={onDeleteClick}>
        Delete
      </button>
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

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onChange }: any) => (
    <button type="button" onClick={() => onChange(["team-1"])}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/ServiceSearch/ServiceSearch", () => ({
  __esModule: true,
  default: () => <div data-testid="service-search" />,
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

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";

describe("SpecialityCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: "team-1", name: "Dr. Avery" },
    ]);
  });

  it("updates lead and staff selections", () => {
    const setFormData = jest.fn();
    const speciality: SpecialityWeb = {
      name: "Surgery",
      headName: "",
      headUserId: "",
      teamMemberIds: [],
      services: [
        {
          id: "svc-1",
          name: "Checkup",
          description: "",
          durationMinutes: 30,
          cost: 10,
          maxDiscount: 0,
        },
      ],
    } as SpecialityWeb;

    render(
      <SpecialityCard
        setFormData={setFormData}
        speciality={speciality}
        index={0}
      />
    );

    fireEvent.click(screen.getByText("Select Lead: Dr. Avery"));
    fireEvent.click(screen.getByText("Assigned staff"));

    expect(setFormData).toHaveBeenCalled();

    const updateLead = setFormData.mock.calls[0][0];
    const updatedLead = updateLead([speciality]);
    expect(updatedLead[0].headUserId).toBe("team-1");

    const updateStaff = setFormData.mock.calls[1][0];
    const updatedStaff = updateStaff([speciality]);
    expect(updatedStaff[0].teamMemberIds).toEqual(["team-1"]);
  });

  it("updates service fields and handles delete", () => {
    const setFormData = jest.fn();
    const speciality: SpecialityWeb = {
      name: "Surgery",
      services: [
        {
          id: "svc-1",
          name: "Checkup",
          description: "Old",
          durationMinutes: 30,
          cost: 10,
          maxDiscount: 0,
        },
      ],
    } as SpecialityWeb;

    render(
      <SpecialityCard
        setFormData={setFormData}
        speciality={speciality}
        index={0}
      />
    );

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "New" },
    });

    const updateService = setFormData.mock.calls[0][0];
    const updated = updateService([speciality]);
    expect(updated[0].services?.[0].description).toBe("New");

    fireEvent.click(screen.getByText("Delete"));
    const removeService = setFormData.mock.calls[1][0];
    const afterDelete = removeService([speciality]);
    expect(afterDelete[0].services).toHaveLength(0);
  });
});
