import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/(routes)/tasks/page";

jest.mock("@/app/pages/Tasks", () => {
  return function MockProtectedTasks() {
    return <div data-testid="protected-tasks-mock">Tasks Content</div>;
  };
});

describe("Tasks Page", () => {
  it("renders the ProtectedTasks component correctly", () => {
    render(<Page />);
    const childComponent = screen.getByTestId("protected-tasks-mock");
    expect(childComponent).toBeInTheDocument();
  });
});
