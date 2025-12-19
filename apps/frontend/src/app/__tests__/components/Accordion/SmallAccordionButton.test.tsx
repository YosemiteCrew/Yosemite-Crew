import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SmallAccordionButton from "@/app/components/Accordion/SmallAccordionButton";

describe("SmallAccordionButton", () => {
  const mockButtonClick = jest.fn();
  const defaultProps = {
    title: "Test Accordion",
    buttonTitle: "Action Button",
    buttonClick: mockButtonClick,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders closed by default and toggles content on click", () => {
    render(
      <SmallAccordionButton {...defaultProps}>
        <div data-testid="accordion-content">Hidden Content</div>
      </SmallAccordionButton>
    );

    expect(screen.queryByTestId("accordion-content")).not.toBeInTheDocument();

    const arrowIcon = document.querySelector("svg");
    expect(arrowIcon).toHaveClass("-rotate-90");

    const toggleButton = screen.getByText("Test Accordion").closest("button");
    fireEvent.click(toggleButton!);

    expect(screen.getByTestId("accordion-content")).toBeInTheDocument();
    expect(arrowIcon).toHaveClass("rotate-0");
  });

  it("renders open initially when defaultOpen is true", () => {
    render(
      <SmallAccordionButton {...defaultProps} defaultOpen={true}>
        <div data-testid="accordion-content">Visible Content</div>
      </SmallAccordionButton>
    );

    expect(screen.getByTestId("accordion-content")).toBeInTheDocument();
  });

  it("renders the action button and handles clicks correctly", () => {
    render(<SmallAccordionButton {...defaultProps} showButton={true} />);

    const actionButton = screen.getByText("Action Button");
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);

    expect(mockButtonClick).toHaveBeenCalledTimes(1);
    expect(mockButtonClick).toHaveBeenCalledWith(true);
  });

  it("does not render the action button when showButton is false", () => {
    render(<SmallAccordionButton {...defaultProps} showButton={false} />);

    const actionButton = screen.queryByText("Action Button");
    expect(actionButton).not.toBeInTheDocument();
  });
});
