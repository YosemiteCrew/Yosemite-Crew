import "../../../../test-helpers/testMocks";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock(
  "@/app/components/Inputs/SpecialitySearch/SpecialitySearch",
  () => ({
    __esModule: true,
    default: () => <div data-testid="speciality-search" />,
  })
);

jest.mock("@/app/components/Cards/SpecialityCard/SpecialityCard", () => ({
  __esModule: true,
  default: ({ speciality }: any) => (
    <div data-testid="speciality-card">{speciality.name}</div>
  ),
}));

import SpecialityStep from "@/app/components/Steps/CreateOrg/SpecialityStep";

describe("CreateOrg SpecialityStep", () => {
  const setSpecialities = jest.fn();

  beforeEach(() => {
    mockPush.mockReset();
  });

  test("does not navigate when no active services selected", () => {
    const specialities = [
      { key: "cardio", name: "Cardiology", active: true, services: [] },
    ];

    render(
      <SpecialityStep
        prevStep={jest.fn()}
        specialities={specialities}
        setSpecialities={setSpecialities}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("navigates to dashboard when at least one active service exists", () => {
    const specialities = [
      {
        key: "cardio",
        name: "Cardiology",
        active: true,
        services: [{ name: "Consultation", active: true }],
      },
    ];

    render(
      <SpecialityStep
        prevStep={jest.fn()}
        specialities={specialities}
        setSpecialities={setSpecialities}
      />
    );

    fireEvent.click(screen.getByText("Next"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });
});
