import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompanionsPage from "@/app/pages/Companions/Companions";

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Filters/CompanionFilters", () => ({
  __esModule: true,
  default: () => <div data-testid="filters" />,
}));

jest.mock("@/app/components/DataTable/CompanionsTable", () => ({
  __esModule: true,
  default: ({ setViewCompanion, setBookAppointment, setAddTask }: any) => (
    <div>
      <button type="button" onClick={() => setViewCompanion(true)}>
        View Companion
      </button>
      <button type="button" onClick={() => setBookAppointment(true)}>
        Book Appointment
      </button>
      <button type="button" onClick={() => setAddTask(true)}>
        Add Task
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/AddCompanion", () => ({
  __esModule: true,
  default: ({ showModal }: any) => (
    <div data-testid="add-companion" data-open={showModal} />
  ),
}));

jest.mock("@/app/components/CompanionInfo", () => ({
  __esModule: true,
  default: ({ showModal }: any) => (
    <div data-testid="companion-info" data-open={showModal} />
  ),
}));

jest.mock("@/app/pages/Companions/BookAppointment", () => ({
  __esModule: true,
  default: ({ showModal }: any) => (
    <div data-testid="book-appointment" data-open={showModal} />
  ),
}));

jest.mock("@/app/pages/Companions/AddTask", () => ({
  __esModule: true,
  default: ({ showModal }: any) => (
    <div data-testid="add-task" data-open={showModal} />
  ),
}));

const mockCompanions = [
  {
    companion: { id: "comp-1", name: "Buddy" },
    parent: { id: "parent-1", firstName: "Jamie" },
  },
];

jest.mock("@/app/hooks/useCompanion", () => ({
  useCompanionsParentsForPrimaryOrg: () => mockCompanions,
}));

describe("Companions page", () => {
  it("renders list count and toggles modals", () => {
    render(<CompanionsPage />);

    expect(screen.getByText("Companions")).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("add-companion")).toHaveAttribute(
      "data-open",
      "true"
    );

    fireEvent.click(screen.getByText("View Companion"));
    expect(screen.getByTestId("companion-info")).toHaveAttribute(
      "data-open",
      "true"
    );

    fireEvent.click(screen.getByText("Book Appointment"));
    expect(screen.getByTestId("book-appointment")).toHaveAttribute(
      "data-open",
      "true"
    );

    fireEvent.click(screen.getByText("Add Task"));
    expect(screen.getByTestId("add-task")).toHaveAttribute("data-open", "true");
  });
});
