import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Team from "@/app/features/organization/pages/Organization/Sections/Team/Team";

const useTeamMock = jest.fn();
const usePermissionsMock = jest.fn();
const accordionButtonSpy = jest.fn();

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
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

jest.mock("@/app/ui/tables/AvailabilityTable", () => () => (
  <div data-testid="availability-table" />
));

jest.mock("@/app/features/organization/pages/Organization/Sections/Team/AddTeam", () => () => (
  <div data-testid="add-team" />
));

jest.mock("@/app/features/organization/pages/Organization/Sections/Team/TeamInfo", () => () => (
  <div data-testid="team-info" />
));

describe("Team section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTeamMock.mockReturnValue([{ _id: "team-1", name: "Alex" }]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
  });

  it("renders team table and add button", () => {
    render(<Team />);

    expect(screen.getByTestId("availability-table")).toBeInTheDocument();
    expect(accordionButtonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ showButton: true })
    );
  });
});
