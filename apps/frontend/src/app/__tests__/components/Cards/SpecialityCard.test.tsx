import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/Inputs/ServiceSearch/ServiceSearch", () => ({
  __esModule: true,
  default: ({ speciality }: { speciality: { name: string } }) => (
    <div data-testid="service-search">{speciality.name}</div>
  ),
}));

import SpecialityCard from "@/app/components/Cards/SpecialityCard/SpecialityCard";

const speciality = {
  key: "cardiology",
  name: "Cardiology",
  services: [
    { name: "Consultation", active: true },
    { name: "Follow up", active: false },
  ],
};

describe("SpecialityCard", () => {
  test("renders active services and toggles checkbox", () => {
    const setSpecialities = jest.fn();
    render(
      <SpecialityCard
        speciality={speciality}
        setSpecialities={setSpecialities}
      />
    );

    expect(screen.getAllByText("Cardiology")[0]).toBeInTheDocument();
    const checkbox = screen.getByLabelText("Consultation");
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(setSpecialities).toHaveBeenCalled();
    expect(typeof setSpecialities.mock.calls[0][0]).toBe("function");
  });

  test("delete button marks speciality inactive", () => {
    const setSpecialities = jest.fn();
    const { container } = render(
      <SpecialityCard
        speciality={speciality}
        setSpecialities={setSpecialities}
      />
    );

    const deleteButton =
      container.querySelector<HTMLButtonElement>(".speciality-delete");
    expect(deleteButton).toBeInTheDocument();
    if (!deleteButton) {
      throw new Error("Delete button not found in Speciality Card");
    }
    fireEvent.click(deleteButton);
    expect(setSpecialities).toHaveBeenCalled();
  });
});
