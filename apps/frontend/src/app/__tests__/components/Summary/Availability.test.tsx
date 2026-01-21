import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Availability from "@/app/components/Summary/Availability";

const useTeamForPrimaryOrgMock = jest.fn();

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => useTeamForPrimaryOrgMock(),
}));

const availabilityTableSpy = jest.fn();

jest.mock("@/app/components/DataTable/AvailabilityTable", () => ({
  __esModule: true,
  default: ({ filteredList, setActive, setView }: any) => {
    availabilityTableSpy({ filteredList, setActive, setView });
    return (
      <div>
        <div data-testid="filtered-count">{filteredList.length}</div>
        <button
          type="button"
          onClick={() => {
            setActive(filteredList[0]);
            setView(true);
          }}
        >
          Open
        </button>
      </div>
    );
  },
}));

const teamInfoSpy = jest.fn();

jest.mock("@/app/pages/Organization/Sections/Team/TeamInfo", () => ({
  __esModule: true,
  default: (props: any) => {
    teamInfoSpy(props);
    return <div data-testid="team-info" />;
  },
}));

describe("Summary Availability", () => {
  const team = [
    { _id: "team-1", name: "Alex", status: "AVAILABLE" },
    { _id: "team-2", name: "Jamie", status: "OFF-DUTY" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useTeamForPrimaryOrgMock.mockReturnValue(team);
  });

  it("filters by status and opens team info", () => {
    render(<Availability />);

    expect(screen.getByText("Availability")).toBeInTheDocument();
    expect(screen.getByTestId("filtered-count")).toHaveTextContent("2");

    fireEvent.click(screen.getByText("Available"));
    expect(screen.getByTestId("filtered-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByText("Open"));
    expect(teamInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        showModal: true,
        activeTeam: team[0],
      })
    );
  });
});
