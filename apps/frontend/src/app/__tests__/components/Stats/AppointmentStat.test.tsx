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

import AppointmentStat from "@/app/components/Stats/AppointmentStat";

describe("AppointmentStat", () => {
  test("wires CardHeader and DynamicChartCard with expected props", () => {
    render(<AppointmentStat />);

    expect(mockCardHeader).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Appointments" })
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
    expect(mockChart.mock.calls[0][0].data).toHaveLength(6);
  });
});
