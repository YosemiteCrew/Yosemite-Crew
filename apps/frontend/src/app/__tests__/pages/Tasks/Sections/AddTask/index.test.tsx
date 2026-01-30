import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import "@/app/__tests__/testUtils/taskAddTaskTestMocks";
import AddTask from "@/app/pages/Tasks/Sections/AddTask";

describe("Tasks AddTask", () => {
  it("shows validation errors when saving empty form", () => {
    render(<AddTask showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Please select a companion or staff")
    ).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });
});
