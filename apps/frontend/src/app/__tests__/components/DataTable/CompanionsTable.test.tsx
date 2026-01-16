import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompanionsTable from "@/app/components/DataTable/CompanionsTable";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt || "companion"} />
  ),
}));

jest.mock("react-icons/fa", () => ({
  FaCalendar: () => <span data-testid="icon-calendar" />,
  FaTasks: () => <span data-testid="icon-tasks" />,
}));

jest.mock("react-icons/io5", () => ({
  IoEye: () => <span data-testid="icon-eye" />,
}));

jest.mock("@/app/components/Cards/CompanionCard/CompanionCard", () => ({
  __esModule: true,
  default: ({ companion, handleViewCompanion }: any) => (
    <div data-testid="mobile-card">
      <span>{companion.companion.name}</span>
      <button
        type="button"
        onClick={() => handleViewCompanion(companion)}
      >
        View Mobile
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <table data-testid="generic-table">
      <tbody>
        {data.map((row: any, rowIndex: number) => (
          <tr key={rowIndex} data-testid="table-row">
            {columns.map((col: any) => (
              <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

jest.mock("@/app/utils/date", () => ({
  getAgeInYears: () => 3,
}));

jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: () => true,
}));

jest.mock("@/app/utils/validators", () => ({
  toTitleCase: (val: string) =>
    val ? val[0].toUpperCase() + val.slice(1).toLowerCase() : "",
}));

describe("CompanionsTable", () => {
  const companion = {
    companion: {
      id: "comp-1",
      organisationId: "org-1",
      parentId: "parent-1",
      name: "Buddy",
      breed: "Husky",
      type: "dog",
      gender: "male",
      dateOfBirth: "2020-01-01",
      allergy: "Pollen",
      status: "active",
      photoUrl: "https://example.com/photo.png",
    },
    parent: {
      id: "parent-1",
      firstName: "Jamie",
    },
  } as any;

  it("renders data in table and mobile cards", () => {
    render(
      <CompanionsTable
        filteredList={[companion]}
        activeCompanion={null}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
      />
    );

    const table = screen.getByTestId("generic-table");
    const tableScope = within(table);
    expect(tableScope.getByText("Buddy")).toBeInTheDocument();
    expect(tableScope.getByText("Husky")).toBeInTheDocument();
    expect(tableScope.getByText("/dog")).toBeInTheDocument();
    expect(tableScope.getByText("Jamie")).toBeInTheDocument();

    const cards = screen.getAllByTestId("mobile-card");
    expect(cards).toHaveLength(1);
  });

  it("handles table actions", () => {
    const setActiveCompanion = jest.fn();
    const setViewCompanion = jest.fn();
    const setBookAppointment = jest.fn();
    const setAddTask = jest.fn();

    render(
      <CompanionsTable
        filteredList={[companion]}
        activeCompanion={null}
        setActiveCompanion={setActiveCompanion}
        setViewCompanion={setViewCompanion}
        setBookAppointment={setBookAppointment}
        setAddTask={setAddTask}
      />
    );

    fireEvent.click(screen.getByTestId("icon-eye").closest("button")!);
    expect(setActiveCompanion).toHaveBeenCalledWith(companion);
    expect(setViewCompanion).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByTestId("icon-calendar").closest("button")!);
    expect(setBookAppointment).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByTestId("icon-tasks").closest("button")!);
    expect(setAddTask).toHaveBeenCalledWith(true);
  });

  it("renders empty state when no data", () => {
    render(
      <CompanionsTable
        filteredList={[]}
        activeCompanion={null}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
      />
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
