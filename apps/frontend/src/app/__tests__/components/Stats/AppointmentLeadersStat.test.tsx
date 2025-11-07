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

import AppointmentLeadersStat from "@/app/components/Stats/AppointmentLeadersStat";

describe("AppointmentLeadersStat", () => {
  test("configures chart with vertical layout and hidden keys", () => {
    render(<AppointmentLeadersStat />);

    expect(mockCardHeader).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Appointment leaders" })
    );
    expect(mockChart).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: "vertical",
        hideKeys: true,
      })
    );
  });
});
