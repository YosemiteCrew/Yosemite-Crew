import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import CompanionCard from "@/app/components/Cards/CompanionCard/CompanionCard";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt || ""} {...props} />,
}));

jest.mock("@/app/components/DataTable/CompanionsTable", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "pink", color: "white" })),
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

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("CompanionCard", () => {
  const handleViewCompanion = jest.fn();
  const handleBookAppointment = jest.fn();
  const handleAddTask = jest.fn();

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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders companion details and status", () => {
    render(
      <CompanionCard
        companion={companion}
        handleViewCompanion={handleViewCompanion}
        handleBookAppointment={handleBookAppointment}
        handleAddTask={handleAddTask}
        canEditAppointments
        canEditTasks
      />
    );

    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("Labrador / Dog")).toBeInTheDocument();
    expect(screen.getByText("Parent / Co-parent:")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("Gender / Age:")).toBeInTheDocument();
    expect(screen.getByText("Male - 2y")).toBeInTheDocument();
    expect(screen.getByText("Allergies:")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("calls action handlers", () => {
    render(
      <CompanionCard
        companion={companion}
        handleViewCompanion={handleViewCompanion}
        handleBookAppointment={handleBookAppointment}
        handleAddTask={handleAddTask}
        canEditAppointments
        canEditTasks
      />
    );

    fireEvent.click(screen.getByText("View"));
    fireEvent.click(screen.getByText("Schedule"));
    fireEvent.click(screen.getByText("Task"));

    expect(handleViewCompanion).toHaveBeenCalledWith(companion);
    expect(handleBookAppointment).toHaveBeenCalledWith(companion);
    expect(handleAddTask).toHaveBeenCalledWith(companion);
  });

  it("hides optional actions based on permissions", () => {
    render(
      <CompanionCard
        companion={companion}
        handleViewCompanion={handleViewCompanion}
        handleBookAppointment={handleBookAppointment}
        handleAddTask={handleAddTask}
        canEditAppointments={false}
        canEditTasks={false}
      />
    );

    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.queryByText("Schedule")).not.toBeInTheDocument();
    expect(screen.queryByText("Task")).not.toBeInTheDocument();
  });
});
