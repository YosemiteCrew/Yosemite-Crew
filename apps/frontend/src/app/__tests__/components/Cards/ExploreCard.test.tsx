import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/Cards/CardHeader/CardHeader", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => (
    <div data-testid="card-header">{title}</div>
  ),
}));

import ExploreCard from "@/app/components/Cards/ExploreCard/ExploreCard";

describe("ExploreCard", () => {
  test("renders card header and default stats", () => {
    render(<ExploreCard />);

    expect(screen.getByTestId("card-header")).toHaveTextContent("Explore");

    for (const label of ["Revenue", "Appointments", "Tasks", "Staff on duty"]) {
      const statLabel = screen.getByText(label);
      expect(statLabel).toBeInTheDocument();
      const statValue = statLabel.nextSibling as HTMLElement | null;
      expect(statValue?.textContent).toBeDefined();
    }
  });
});
