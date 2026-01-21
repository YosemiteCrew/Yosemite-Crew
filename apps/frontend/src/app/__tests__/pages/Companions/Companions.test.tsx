import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Companions from "@/app/pages/Companions/Companions";
import { CompanionParent } from "@/app/pages/Companions/types";

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/stores/searchStore", () => ({
  useSearchStore: (selector: any) => selector({ query: "" }),
}));

const useCompanionsMock = jest.fn();

jest.mock("@/app/hooks/useCompanion", () => ({
  useCompanionsParentsForPrimaryOrg: () => useCompanionsMock(),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Filters/Filters", () => ({
  __esModule: true,
  default: () => <div data-testid="filters" />,
}));

const companionsTableSpy = jest.fn();

jest.mock("@/app/components/DataTable/CompanionsTable", () => ({
  __esModule: true,
  default: (props: any) => {
    companionsTableSpy(props);
    return <div data-testid="companions-table" />;
  },
}));

jest.mock("@/app/components/AddCompanion", () => ({
  __esModule: true,
  default: ({ showModal }: any) =>
    showModal ? <div data-testid="add-companion" /> : null,
}));

jest.mock("@/app/components/CompanionInfo", () => ({
  __esModule: true,
  default: () => <div data-testid="companion-info" />,
}));

jest.mock("@/app/pages/Companions/BookAppointment", () => ({
  __esModule: true,
  default: () => <div data-testid="book-appointment" />,
}));

jest.mock("@/app/pages/Companions/AddTask", () => ({
  __esModule: true,
  default: () => <div data-testid="add-task" />,
}));

describe("Companions page", () => {
  const companions: CompanionParent[] = [
    {
      companion: {
        id: "comp-1",
        name: "Buddy",
        type: "dog",
        status: "active",
      } as any,
      parent: { id: "parent-1", name: "Alex" } as any,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useCompanionsMock.mockReturnValue(companions);
  });

  it("renders count and opens add companion modal", () => {
    render(<Companions />);

    expect(screen.getByText("(1)")).toBeInTheDocument();
    expect(screen.getByTestId("companions-table")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("add-companion")).toBeInTheDocument();
  });
});
