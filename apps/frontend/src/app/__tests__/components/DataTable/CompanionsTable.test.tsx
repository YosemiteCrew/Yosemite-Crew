import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import CompanionsTable from "@/app/components/DataTable/CompanionsTable";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt || ""} {...props} />,
}));

jest.mock("@/app/utils/date", () => ({
  getAgeInYears: jest.fn(() => "2y"),
}));

jest.mock("@/app/utils/urls", () => ({
  getSafeImageUrl: jest.fn(() => "image"),
}));

jest.mock("@/app/utils/validators", () => ({
  toTitleCase: (value: string) => value.toUpperCase(),
}));

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="table">
      {data.map((item: any) => (
        <div key={item.companion.name}>
          {columns.map((col: any) => (
            <div key={col.key || col.label}>
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

jest.mock("react-icons/fa", () => ({
  FaCalendar: () => <span>calendar-icon</span>,
  FaTasks: () => <span>task-icon</span>,
}));

jest.mock("react-icons/io5", () => ({
  IoEye: () => <span>view-icon</span>,
}));

describe("CompanionsTable", () => {
  const companion: any = {
    companion: {
      name: "Buddy",
      breed: "Labrador",
      type: "Dog",
      gender: "Male",
      dateOfBirth: "2023-01-01",
      allergy: "None",
      status: "active",
      photoUrl: "photo",
    },
    parent: { firstName: "Sam" },
  };

  it("handles view, schedule, and task actions", () => {
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
        canEditAppointments
        canEditTasks
      />
    );

    fireEvent.click(screen.getByText("view-icon").closest("button")!);
    fireEvent.click(screen.getByText("calendar-icon").closest("button")!);
    fireEvent.click(screen.getByText("task-icon").closest("button")!);

    expect(setActiveCompanion).toHaveBeenCalledWith(companion);
    expect(setViewCompanion).toHaveBeenCalledWith(true);
    expect(setBookAppointment).toHaveBeenCalledWith(true);
    expect(setAddTask).toHaveBeenCalledWith(true);
  });

  it("shows empty state for mobile list", () => {
    render(
      <CompanionsTable
        filteredList={[]}
        activeCompanion={null}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
        canEditAppointments={false}
        canEditTasks={false}
      />
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
