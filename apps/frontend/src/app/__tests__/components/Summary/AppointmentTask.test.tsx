import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/DataTable/Appointments", () => ({
  __esModule: true,
  default: () => <div data-testid="appointments-table" />,
}));

jest.mock("@/app/components/DataTable/Tasks", () => ({
  __esModule: true,
  default: () => <div data-testid="tasks-table" />,
}));

jest.mock("next/link", () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

import AppointmentTask from "@/app/components/Summary/AppointmentTask";

describe("Summary AppointmentTask widget", () => {
  test("toggles between appointments and tasks tables", () => {
    render(<AppointmentTask />);

    const seeAll = screen.getByText("See all");
    expect(screen.getByTestId("appointments-table")).toBeInTheDocument();
    expect(seeAll).toHaveAttribute("href", "/appoinments");
    expect(screen.queryByTestId("tasks-table")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(screen.getByTestId("tasks-table")).toBeInTheDocument();
    expect(screen.queryByTestId("appointments-table")).not.toBeInTheDocument();

    expect(seeAll).toHaveAttribute("href", "/tasks");
  });
});
