/* eslint-disable @next/next/no-img-element */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompanionsTable from "@/app/components/DataTable/CompanionsTable";

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="table">
      {data.map((item: any, idx: number) => (
        <div key={item.id+idx}>
          {columns.map((col: any, cIdx: number) => (
            <div key={col.key || cIdx}>
              {col.render ? col.render(item) : item[col.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/Cards/CompanionCard/CompanionCard", () => ({
  __esModule: true,
  default: ({ companion }: any) => (
    <div data-testid="companion-card">{companion.companion.name}</div>
  ),
}));

jest.mock("@/app/utils/date", () => ({
  getAgeInYears: () => "2",
}));

jest.mock("@/app/utils/urls", () => ({
  getSafeImageUrl: () => "https://example.com/pet.png",
}));

jest.mock("@/app/utils/validators", () => ({
  toTitleCase: (value: string) => value,
}));

jest.mock("react-icons/io5", () => ({
  IoEye: () => <span>eye</span>,
}));

jest.mock("react-icons/fa", () => ({
  FaCalendar: () => <span>calendar</span>,
  FaTasks: () => <span>task</span>,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

describe("CompanionsTable", () => {
  it("handles actions from table", () => {
    const setActiveCompanion = jest.fn();
    const setViewCompanion = jest.fn();
    const setBookAppointment = jest.fn();
    const setAddTask = jest.fn();
    const companion: any = {
      companion: {
        name: "Buddy",
        breed: "Lab",
        type: "dog",
        gender: "male",
        dateOfBirth: new Date(),
        status: "active",
        photoUrl: "",
      },
      parent: { firstName: "Jordan" },
    };

    render(
      <CompanionsTable
        filteredList={[companion]}
        activeCompanion={companion}
        setActiveCompanion={setActiveCompanion}
        setViewCompanion={setViewCompanion}
        setBookAppointment={setBookAppointment}
        setAddTask={setAddTask}
      />
    );

    const table = screen.getByTestId("table");
    fireEvent.click(within(table).getByText("eye"));
    fireEvent.click(within(table).getByText("calendar"));
    fireEvent.click(within(table).getByText("task"));

    expect(setActiveCompanion).toHaveBeenCalledWith(companion);
    expect(setViewCompanion).toHaveBeenCalledWith(true);
    expect(setBookAppointment).toHaveBeenCalledWith(true);
    expect(setAddTask).toHaveBeenCalledWith(true);
  });

  it("shows empty state on mobile list", () => {
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
