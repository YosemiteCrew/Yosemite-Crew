import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const serviceSearchMock = jest.fn(
  ({ handleToggle }: { handleToggle: (name: string) => void }) => (
    <button onClick={() => handleToggle("Cleaning")}>mock-search</button>
  )
);

jest.mock("@/app/components/Inputs/ServiceSearch/ServiceSearch", () => ({
  __esModule: true,
  default: (props: any) => serviceSearchMock(props),
}));

import SpecialityCard from "@/app/components/Cards/SpecialityCard/SpecialityCard";

const speciality = {
  key: "dental",
  name: "Dental",
  services: [
    { name: "Cleaning", active: true },
    { name: "Surgery", active: false },
  ],
};

describe("<SpecialityCard />", () => {
  test("renders active services and empty state when none active", () => {
    const setSpecialities = jest.fn();
    const inactive = { ...speciality, services: [] };
    const { rerender } = render(
      <SpecialityCard
        speciality={inactive}
        setSpecialities={setSpecialities}
      />
    );
    expect(
      screen.getByText(/Search and add services/i)
    ).toBeInTheDocument();

    rerender(
      <SpecialityCard speciality={speciality} setSpecialities={setSpecialities} />
    );
    expect(screen.getByText("Cleaning")).toBeInTheDocument();
  });

  test("invokes delete handler and toggle updates services", () => {
    let updated: any[] | undefined;
    const setSpecialities = jest.fn((updater: any) => {
      if (typeof updater === "function") {
        updated = updater([speciality]);
      }
    });

    const { container } = render(
      <SpecialityCard speciality={speciality} setSpecialities={setSpecialities} />
    );

    fireEvent.click(container.querySelector(".speciality-delete")!);
    expect(updated?.[0].active).toBe(false);

    fireEvent.click(screen.getByText("Cleaning").nextSibling as HTMLElement);
    expect(updated?.[0].services[0].active).toBe(false);
  });

  test("passes handleToggle down to ServiceSearch mock", () => {
    const setSpecialities = jest.fn((updater: any) => {
      if (typeof updater === "function") {
        updater([speciality]);
      }
    });

    render(
      <SpecialityCard speciality={speciality} setSpecialities={setSpecialities} />
    );

    fireEvent.click(screen.getByText("mock-search"));
    expect(setSpecialities).toHaveBeenCalled();
  });
});
