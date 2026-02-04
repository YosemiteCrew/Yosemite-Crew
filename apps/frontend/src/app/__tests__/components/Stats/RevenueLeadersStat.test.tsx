import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RevenueLeadersStat from "@/app/ui/widgets/Stats/RevenueLeadersStat";
import CardHeader from "@/app/ui/cards/CardHeader/CardHeader";

jest.mock("@/app/ui/cards/CardHeader/CardHeader", () => ({
  __esModule: true,
  default: jest.fn(({ title }: any) => (
    <div data-testid="card-header">{title}</div>
  )),
}));

describe("RevenueLeadersStat", () => {
  it("renders revenue tiles", () => {
    render(<RevenueLeadersStat />);

    expect(screen.getByTestId("card-header")).toHaveTextContent(
      "Revenue leaders"
    );
    expect(screen.getAllByText("$0")).toHaveLength(3);
    expect(screen.getByText("General Medicine")).toBeInTheDocument();
    expect(screen.getByText("Surgery")).toBeInTheDocument();
    expect(screen.getByText("Oncology")).toBeInTheDocument();
    expect(CardHeader).toHaveBeenCalled();
  });
});
