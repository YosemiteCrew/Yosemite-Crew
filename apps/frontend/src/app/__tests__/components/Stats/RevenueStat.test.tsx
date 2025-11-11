import React from "react";
import { render } from "@testing-library/react";

const mockCardHeader = jest.fn();
const mockChart = jest.fn();

jest.mock("@/app/components/Cards/CardHeader/CardHeader", () => ({
  __esModule: true,
  default: (props: any) => {
    mockCardHeader(props);
    return null;
  },
}));

jest.mock("@/app/components/BarGraph/DynamicChartCard", () => ({
  __esModule: true,
  default: (props: any) => {
    mockChart(props);
    return null;
  },
}));

import RevenueStat from "@/app/components/Stats/RevenueStat";

describe("RevenueStat", () => {
  test("renders Revenue chart with default config", () => {
    render(<RevenueStat />);

    expect(mockCardHeader).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Revenue" })
    );
    expect(mockChart).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Array),
        keys: [
          { name: "Completed", color: "#111" },
          { name: "Cancelled", color: "#ccc" },
        ],
      })
    );
  });
});
