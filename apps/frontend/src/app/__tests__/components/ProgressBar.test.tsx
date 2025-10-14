import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProgressBar from "@/app/components/ProgressBar/ProgressBar"; 

describe("ProgressBar Component", () => {
  it("should render the progress bar with the correct value and accessible text", () => {
    const progressValue = 75;
    render(<ProgressBar progress={progressValue} />);

    const progressBarElement = screen.getByRole("progressbar");

    expect(progressBarElement).toBeInTheDocument();

    expect(progressBarElement).toHaveAttribute("value", "75");

    expect(progressBarElement).toHaveTextContent("75%");

    expect(screen.getByText("75% Complete")).toBeInTheDocument();
  });

  it("should handle a progress value of 0", () => {
    render(<ProgressBar progress={0} />);
    const progressBarElement = screen.getByRole("progressbar");
    expect(progressBarElement).toBeInTheDocument();
    expect(progressBarElement).toHaveAttribute("value", "0");
    expect(screen.getByText("0% Complete")).toBeInTheDocument();
  });

  it("should handle a progress value of 100", () => {
    render(<ProgressBar progress={100} />);
    const progressBarElement = screen.getByRole("progressbar");
    expect(progressBarElement).toBeInTheDocument();
    expect(progressBarElement).toHaveAttribute("value", "100");
    expect(screen.getByText("100% Complete")).toBeInTheDocument();
  });
});
