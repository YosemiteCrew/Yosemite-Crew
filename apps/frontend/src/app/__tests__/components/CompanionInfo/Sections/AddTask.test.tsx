import React from "react";
import { render, screen } from "@testing-library/react";
import AddTask from "@/app/components/CompanionInfo/Sections/AddTask";

// --- Mocks ---

// Mock the Accordion to verify props passed to it
jest.mock("@/app/components/Accordion/Accordion", () => {
  return function MockAccordion(props: any) {
    return (
      <div data-testid="accordion-mock">
        <span data-testid="accordion-title">{props.title}</span>
        <span data-testid="accordion-default-open">
          {props.defaultOpen ? "true" : "false"}
        </span>
        <span data-testid="accordion-show-edit">
          {props.showEditIcon ? "true" : "false"}
        </span>
      </div>
    );
  };
});

describe("AddTask Component", () => {
  // --- 1. Rendering Structure ---

  it("renders the main page title", () => {
    render(<AddTask />);
    // The component renders "Add task" twice: once as a header, once in the Accordion
    // We specifically check for the header container class or just existence
    const titles = screen.getAllByText("Add task");
    expect(titles.length).toBeGreaterThanOrEqual(1);

    // Check for the specific header div class if strictness is needed
    const header = document.querySelector(".font-grotesk");
    expect(header).toHaveTextContent("Add task");
  });

  it("renders the Accordion component", () => {
    render(<AddTask />);
    expect(screen.getByTestId("accordion-mock")).toBeInTheDocument();
  });

  // --- 2. Props Integration ---

  it("passes correct props to the Accordion", () => {
    render(<AddTask />);

    // Verify Title Prop
    expect(screen.getByTestId("accordion-title")).toHaveTextContent("Add task");

    // Verify defaultOpen Prop (should be true)
    expect(screen.getByTestId("accordion-default-open")).toHaveTextContent(
      "true"
    );

    // Verify showEditIcon Prop (should be false)
    expect(screen.getByTestId("accordion-show-edit")).toHaveTextContent(
      "false"
    );
  });
});
