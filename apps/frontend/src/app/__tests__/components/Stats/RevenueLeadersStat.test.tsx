import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RevenueLeadersStat from "@/app/components/Stats/RevenueLeadersStat";
import CardHeader from "@/app/components/Cards/CardHeader/CardHeader";

jest.mock("@/app/components/Cards/CardHeader/CardHeader", () => ({
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
