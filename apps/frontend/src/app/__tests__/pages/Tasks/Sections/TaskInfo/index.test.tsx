import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TaskInfo from "@/app/pages/Tasks/Sections/TaskInfo";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="modal">{children}</div>,
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div>
      <div>{title}</div>
      <div data-testid="assigned-by">{data.assignedBy}</div>
      <div data-testid="assigned-to">{data.assignedTo}</div>
    </div>
  ),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [
    { _id: "team-1", name: "Dr. Who" },
  ],
}));

describe("TaskInfo", () => {
  it("resolves member names for assignedBy and assignedTo", () => {
    render(
      <TaskInfo
        showModal
        setShowModal={jest.fn()}
        activeTask={{
          assignedBy: "team-1",
          assignedTo: "team-1",
        } as any}
      />
    );

    expect(screen.getByText("Task details")).toBeInTheDocument();
    expect(screen.getByTestId("assigned-by")).toHaveTextContent("Dr. Who");
    expect(screen.getByTestId("assigned-to")).toHaveTextContent("Dr. Who");
  });
});
