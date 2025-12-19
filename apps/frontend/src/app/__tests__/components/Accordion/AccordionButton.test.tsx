import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AccordionButton from "@/app/components/Accordion/AccordionButton";

describe("AccordionButton Component", () => {
  const mockButtonClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders closed by default and toggles content on click", () => {
    render(
      <AccordionButton
        title="Test Accordion"
        buttonTitle="Action"
        buttonClick={mockButtonClick}
      >
        <div data-testid="content">Hidden Content</div>
      </AccordionButton>
    );

    expect(screen.getByText("Test Accordion")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();

    const toggleButton = screen.getByText("Test Accordion").closest("button");
    const icon = toggleButton?.querySelector("svg");
    expect(icon).toHaveClass("-rotate-90");

    fireEvent.click(toggleButton!);

    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(icon).toHaveClass("rotate-0");

    fireEvent.click(toggleButton!);
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("renders open initially when defaultOpen is true", () => {
    render(
      <AccordionButton title="Open Accordion" defaultOpen={true}>
        <div data-testid="content">Visible Content</div>
      </AccordionButton>
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders the action button and handles clicks correctly", () => {
    render(
      <AccordionButton
        title="With Button"
        buttonTitle="Click Me"
        buttonClick={mockButtonClick}
        showButton={true}
      />
    );

    const actionButton = screen.getByText("Click Me");
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);

    expect(mockButtonClick).toHaveBeenCalledTimes(1);
    expect(mockButtonClick).toHaveBeenCalledWith(true);
  });

  it("does not render the action button when showButton is false", () => {
    render(
      <AccordionButton
        title="No Button"
        buttonTitle="Click Me"
        showButton={false}
      />
    );

    expect(screen.queryByText("Click Me")).not.toBeInTheDocument();
  });
});
