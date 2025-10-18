import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import StatusBadge from "@/app/components/StatusBadge/StatusBadge"; 

describe("StatusBadge Component", () => {
  it('should render with the "success" class for "Available" status', () => {
    render(<StatusBadge status="Available" />);

    const badgeElement = screen.getByText("Available");

    expect(badgeElement).toBeInTheDocument();

    expect(badgeElement).toHaveClass("status-badge status-success");
  });

  it('should render with the "secondary" class for "Off-Duty" status', () => {
    render(<StatusBadge status="Off-Duty" />);
    const badgeElement = screen.getByText("Off-Duty");

    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveClass("status-badge status-secondary");
  });

  it('should render with the "danger" class for "Consulting" status', () => {
    render(<StatusBadge status="Consulting" />);
    const badgeElement = screen.getByText("Consulting");

    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveClass("status-badge status-danger");
  });

  it('should render with the fallback "light" class for an unknown status', () => {
    render(<StatusBadge status="On Vacation" />);
    const badgeElement = screen.getByText("On Vacation");

    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveClass("status-badge status-light");
  });
});
