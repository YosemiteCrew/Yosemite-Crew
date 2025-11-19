import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("react-icons/ri", () => ({
  RiEdit2Fill: ({ onClick }: { onClick?: () => void }) => (
    <button data-testid="edit-icon" onClick={onClick}>
      edit
    </button>
  ),
}));

jest.mock("react-icons/io", () => ({
  IoIosArrowDown: ({ className }: { className?: string }) => (
    <span data-testid="arrow" className={className} />
  ),
  IoIosAdd: ({ onClick }: { onClick?: () => void }) => (
    <button data-testid="add-icon" onClick={onClick}>
      add
    </button>
  ),
}));

import Accordion from "@/app/components/Accordion/Accordion";

describe("<Accordion />", () => {
  test("renders title and children when defaultOpen is true", () => {
    render(
      <Accordion title="Details" defaultOpen>
        <div data-testid="accordion-content">Content</div>
      </Accordion>
    );

    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-content")).toBeInTheDocument();
    expect(screen.getByTestId("arrow")).toHaveClass("rotate-0");
  });

  test("toggles visibility when header button is clicked", () => {
    render(
      <Accordion title="Toggle me">
        <div data-testid="accordion-content">Hidden content</div>
      </Accordion>
    );

    expect(screen.queryByTestId("accordion-content")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle me" }));
    expect(screen.getByTestId("accordion-content")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle me" }));
    expect(screen.queryByTestId("accordion-content")).not.toBeInTheDocument();
  });

  test("clicking edit icon opens accordion and calls onEditClick", () => {
    const onEditClick = jest.fn();
    render(
      <Accordion title="Edit me" onEditClick={onEditClick}>
        <div data-testid="accordion-content">Editable</div>
      </Accordion>
    );

    const editButton = screen.getByTestId("edit-icon");
    fireEvent.click(editButton);
    expect(onEditClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("accordion-content")).toBeInTheDocument();
  });

  test("clicking add icon when hasData is false opens accordion", () => {
    const onEditClick = jest.fn();
    render(
      <Accordion title="Add data" hasData={false} onEditClick={onEditClick}>
        <div data-testid="accordion-content">New content</div>
      </Accordion>
    );

    fireEvent.click(screen.getByTestId("add-icon"));
    expect(onEditClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("accordion-content")).toBeInTheDocument();
  });
});
