import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ProtectedCompanions from "@/app/pages/Companions/Companions";

const useCompanionsMock = jest.fn();
const usePermissionsMock = jest.fn();
const useSearchStoreMock = jest.fn();
const companionsTableSpy = jest.fn();

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/hooks/useCompanion", () => ({
  useCompanionsParentsForPrimaryOrg: () => useCompanionsMock(),
}));

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock("@/app/stores/searchStore", () => ({
  useSearchStore: (selector: any) => useSearchStoreMock(selector),
}));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Filters/Filters", () => () => (
  <div data-testid="filters" />
));

jest.mock("@/app/components/DataTable/CompanionsTable", () => (props: any) => {
  companionsTableSpy(props);
  return <div data-testid="companions-table" />;
});

jest.mock("@/app/components/AddCompanion", () => (props: any) =>
  props.showModal ? <div data-testid="add-companion" /> : null
);

jest.mock("@/app/components/CompanionInfo", () => () => (
  <div data-testid="companion-info" />
));

jest.mock("@/app/pages/Companions/BookAppointment", () => () => (
  <div data-testid="book-appointment" />
));

jest.mock("@/app/pages/Companions/AddTask", () => () => (
  <div data-testid="add-task" />
));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("Companions page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCompanionsMock.mockReturnValue([
      {
        companion: { id: "c1", name: "Buddy", status: "active", type: "dog" },
        parent: { firstName: "Sam" },
      },
      {
        companion: { id: "c2", name: "Rex", status: "inactive", type: "cat" },
        parent: { firstName: "Alex" },
      },
    ]);
    usePermissionsMock.mockReturnValue({
      can: jest.fn(() => true),
    });
    useSearchStoreMock.mockImplementation((selector: any) =>
      selector({ query: "buddy" })
    );
  });

  it("renders filtered companions and opens add modal", () => {
    render(<ProtectedCompanions />);

    expect(screen.getByTestId("companions-table")).toBeInTheDocument();
    expect(companionsTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [
          expect.objectContaining({
            companion: expect.objectContaining({ id: "c1" }),
          }),
        ],
      })
    );

    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("add-companion")).toBeInTheDocument();
  });
});
