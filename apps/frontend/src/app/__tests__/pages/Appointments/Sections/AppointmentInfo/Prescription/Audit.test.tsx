import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Audit from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Audit";

describe("Audit", () => {
  it("renders coming soon", () => {
    render(<Audit />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
