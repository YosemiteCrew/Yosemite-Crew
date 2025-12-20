import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskInfo from "@/app/pages/Tasks/Sections/TaskInfo";
import { TasksProps } from "@/app/types/tasks";

// --- Mocks ---

// Mock Modal to render children directly
jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) =>
    showModal ? <div>{children}</div> : null,
}));

// Mock EditableAccordion to verify data passing
jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div data-testid="task-accordion">
      <span>{title}</span>
      <span data-testid="task-name">{data.task}</span>
      <span data-testid="task-status">{data.status}</span>
    </div>
  ),
}));

describe("TaskInfo Component", () => {
  const mockSetShowModal = jest.fn();

  // FIX: Changed 'id' to '_id' and cast status to 'any'
  const mockTask: TasksProps = {
    _id: "1", // Updated property name
    task: "Design System",
    category: "Custom",
    description: "Build components",
    from: "10:00",
    to: "12:00",
    due: new Date("2023-12-31"),
    status: "Pending" as any,
    date: new Date("2023-12-31"),
    title: "Design System",
  } as unknown as TasksProps; // Cast to unknown->TasksProps to handle any other strict type mismatches safely

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering & Data Passing ---

  it("renders the modal content correctly with task details", () => {
    render(
      <TaskInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeTask={mockTask}
      />
    );

    // Header
    expect(screen.getByText("View task")).toBeInTheDocument();

    // Accordion Content (via Mock)
    expect(screen.getByTestId("task-accordion")).toBeInTheDocument();
    expect(screen.getByText("Task details")).toBeInTheDocument();
    expect(screen.getByTestId("task-name")).toHaveTextContent("Design System");
    expect(screen.getByTestId("task-status")).toHaveTextContent("Pending");
  });

  it("does not render when showModal is false (handled by Mock implementation check)", () => {
    const { container } = render(
      <TaskInfo
        showModal={false}
        setShowModal={mockSetShowModal}
        activeTask={mockTask}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  // --- 2. Interaction ---

  it("calls setShowModal(false) when the close icon is clicked", () => {
    const { container } = render(
      <TaskInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeTask={mockTask}
      />
    );

    // Find the clickable close SVG
    const closeIcon = container.querySelector("svg.cursor-pointer");
    if (closeIcon) {
      fireEvent.click(closeIcon);
    } else {
      const svgs = container.querySelectorAll("svg");
      fireEvent.click(svgs[svgs.length - 1]);
    }

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });
});
