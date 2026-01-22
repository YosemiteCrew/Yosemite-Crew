import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import History from "@/app/pages/Appointments/Sections/AppointmentInfo/Info/History";

describe("Appointment history", () => {
  it("renders coming soon message", () => {
    render(<History />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
