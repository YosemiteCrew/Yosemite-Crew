import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import "../../../jest.mocks/testMocks";

const genericTableMock = jest.fn(
  ({ columns, data }: { columns: any[]; data: any[] }) => (
    <div data-testid="generic-table">
      {columns.map((col) => (
        <div key={col.key} data-testid={`col-${col.key}`}>
          {col.render ? col.render(data[0]) : null}
        </div>
      ))}
    </div>
  )
);

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: (props: any) => genericTableMock(props),
}));

const companionCardMock = jest.fn(
  ({ companion }: { companion: any }) => (
    <div data-testid="mobile-card">{companion.name}</div>
  )
);

jest.mock("@/app/components/Cards/CompanionCard/CompanionCard", () => ({
  __esModule: true,
  default: (props: any) => companionCardMock(props),
}));

import CompanionsTable, {
  getStatusStyle,
} from "@/app/components/DataTable/CompanionsTable";

const companions = [
  {
    image: "/img.png",
    name: "Luna",
    breed: "Husky",
    species: "Dog",
    parent: "Alice",
    gender: "Female",
    age: "2y",
    lastMedication: "Pain relief",
    vaccineDue: "May",
    upcomingAppointent: "Apr 14",
    upcomingAppointentTime: "10:00",
    status: "active",
  },
];

describe("<CompanionsTable />", () => {
  beforeEach(() => {
    genericTableMock.mockClear();
    companionCardMock.mockClear();
  });

  test("renders desktop table and mobile cards", () => {
    render(
      <CompanionsTable
        filteredList={companions}
        activeCompanion={companions[0]}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
      />
    );

    expect(genericTableMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: companions })
    );
    expect(companionCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ companion: companions[0] })
    );
  });

  test("calls handlers when \"view\" action triggered", () => {
    const setActive = jest.fn();
    const setView = jest.fn();
    render(
      <CompanionsTable
        filteredList={companions}
        activeCompanion={null}
        setActiveCompanion={setActive}
        setViewCompanion={setView}
      />
    );

    const actionButtons = within(screen.getByTestId("col-actions")).getAllByRole(
      "button"
    );
    fireEvent.click(actionButtons[0]);

    expect(setActive).toHaveBeenCalledWith(companions[0]);
    expect(setView).toHaveBeenCalledWith(true);
  });
});

describe("getStatusStyle", () => {
  test("returns matching palette per status", () => {
    expect(getStatusStyle("Active")).toEqual(
      expect.objectContaining({ color: "#54B492" })
    );
    expect(getStatusStyle("Unknown")).toEqual(
      expect.objectContaining({ color: "#6b7280" })
    );
  });
});
