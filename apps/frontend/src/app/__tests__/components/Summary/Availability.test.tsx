import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Availability from "@/app/components/Summary/Availability";

const useTeamMock = jest.fn();

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

jest.mock("@/app/components/DataTable/AvailabilityTable", () => ({
  __esModule: true,
  default: ({ filteredList }: any) => (
    <div data-testid="availability-table">{filteredList.length}</div>
  ),
}));

describe("Summary Availability", () => {
  it("filters by selected label", () => {
    useTeamMock.mockReturnValue([
      { id: "1", status: "Available" },
      { id: "2", status: "Consulting" },
      { id: "3", status: "Requested" },
    ]);

    render(<Availability />);

    expect(screen.getByTestId("availability-table")).toHaveTextContent("3");

    fireEvent.click(screen.getByRole("button", { name: "Available" }));
    expect(screen.getByTestId("availability-table")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Consulting" }));
    expect(screen.getByTestId("availability-table")).toHaveTextContent("1");
  });
});
