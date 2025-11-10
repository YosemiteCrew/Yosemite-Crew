import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockCardHeader = jest.fn();

jest.mock("@/app/components/Cards/CardHeader/CardHeader", () => ({
  __esModule: true,
  default: (props: any) => {
    mockCardHeader(props);
    return <div data-testid="card-header">{props.title}</div>;
  },
}));

import RevenueLeadersStat from "@/app/components/Stats/RevenueLeadersStat";

describe("RevenueLeadersStat", () => {
  test("renders leaders list and configures CardHeader", () => {
    render(<RevenueLeadersStat />);

    expect(mockCardHeader).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Revenue leaders" })
    );
    const zeros = screen.getAllByText("$0");
    expect(zeros).toHaveLength(3);
    expect(screen.getByText("General Medicine")).toBeInTheDocument();
  });
});
