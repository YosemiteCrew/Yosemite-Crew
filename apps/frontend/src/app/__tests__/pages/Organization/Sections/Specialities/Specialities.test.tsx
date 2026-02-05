import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Specialities from "@/app/features/organization/pages/Organization/Sections/Specialities/Specialities";

const useSpecialitiesMock = jest.fn();
const usePermissionsMock = jest.fn();
const accordionButtonSpy = jest.fn();

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesWithServiceNamesForPrimaryOrg: () => useSpecialitiesMock(),
}));

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock("@/app/ui/layout/guards/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/ui/primitives/Accordion/AccordionButton", () => (props: any) => {
  accordionButtonSpy(props);
  return <div data-testid="accordion-button">{props.children}</div>;
});

jest.mock("@/app/ui/tables/SpecialitiesTable", () => () => (
  <div data-testid="specialities-table" />
));

jest.mock("@/app/features/organization/pages/Organization/Sections/Specialities/AddSpeciality", () => () => (
  <div data-testid="add-speciality" />
));

jest.mock("@/app/features/organization/pages/Organization/Sections/Specialities/SpecialityInfo", () => () => (
  <div data-testid="speciality-info" />
));

describe("Specialities section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSpecialitiesMock.mockReturnValue([
      { _id: "spec-1", name: "Surgery", services: [] },
    ]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
  });

  it("renders specialities table and add button", () => {
    render(<Specialities />);

    expect(screen.getByTestId("specialities-table")).toBeInTheDocument();
    expect(accordionButtonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ showButton: true })
    );
  });
});
