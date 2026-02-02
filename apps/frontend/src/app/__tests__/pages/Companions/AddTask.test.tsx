import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import "@/app/__tests__/testUtils/taskAddTaskTestMocks";
import AddTask from "@/app/features/companions/pages/Companions/AddTask";

describe("Companion AddTask", () => {
  it("shows validation errors when saving empty form", () => {
    render(
      <AddTask
        showModal
        setShowModal={jest.fn()}
        activeCompanion={{
          companion: { id: "comp-1", name: "Buddy" },
          parent: { id: "parent-1", firstName: "Jamie" },
        } as any}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });
});
