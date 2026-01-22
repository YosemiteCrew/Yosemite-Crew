import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Availability from "@/app/components/Summary/Availability";

const useTeamMock = jest.fn();
const usePermissionsMock = jest.fn();
const availabilityTableSpy = jest.fn();
const teamInfoSpy = jest.fn();

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock("@/app/components/DataTable/AvailabilityTable", () => (props: any) => {
  availabilityTableSpy(props);
  return <div data-testid="availability-table" />;
});

jest.mock("@/app/pages/Organization/Sections/Team/TeamInfo", () => (props: any) => {
  teamInfoSpy(props);
  return <div data-testid="team-info" />;
});

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

describe("Availability summary", () => {
  const teams = [
    { _id: "t1", status: "available", name: "Alex" },
    { _id: "t2", status: "off-duty", name: "Sam" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useTeamMock.mockReturnValue(teams);
    usePermissionsMock.mockReturnValue({
      can: jest.fn(() => true),
    });
  });

  it("renders labels and passes filtered list", () => {
    render(<Availability />);

    expect(screen.getByText("Availability")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();

    const props = availabilityTableSpy.mock.calls[0][0];
    expect(props.filteredList).toHaveLength(2);

    fireEvent.click(screen.getByText("Available"));

    const latestProps = availabilityTableSpy.mock.calls.at(-1)[0];
    expect(latestProps.filteredList).toHaveLength(1);
    expect(latestProps.filteredList[0]._id).toBe("t1");

    expect(teamInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        activeTeam: teams[0],
        canEditTeam: true,
      })
    );
  });
});
