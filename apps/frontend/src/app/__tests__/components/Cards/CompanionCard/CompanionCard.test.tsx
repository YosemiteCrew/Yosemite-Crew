import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompanionCard from "@/app/components/Cards/CompanionCard/CompanionCard";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt || "companion"} />
  ),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/app/utils/date", () => ({
  getAgeInYears: () => 5,
}));

jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: () => false,
}));

jest.mock("@/app/utils/validators", () => ({
  toTitleCase: (val: string) =>
    val ? val[0].toUpperCase() + val.slice(1).toLowerCase() : "",
}));

describe("CompanionCard", () => {
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
      photoUrl: "http://invalid-url",
    },
    parent: {
      id: "parent-1",
      firstName: "Jamie",
    },
  } as any;

  it("renders companion details", () => {
    render(
      <CompanionCard
        companion={companion}
        handleViewCompanion={jest.fn()}
        handleBookAppointment={jest.fn()}
        handleAddTask={jest.fn()}
      />
    );

    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("Husky / dog")).toBeInTheDocument();
    expect(screen.getByText("Jamie")).toBeInTheDocument();
    expect(screen.getByText("male - 5")).toBeInTheDocument();
    expect(screen.getByText("Pollen")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("calls action handlers", () => {
    const handleView = jest.fn();
    const handleSchedule = jest.fn();
    const handleTask = jest.fn();

    render(
      <CompanionCard
        companion={companion}
        handleViewCompanion={handleView}
        handleBookAppointment={handleSchedule}
        handleAddTask={handleTask}
      />
    );

    fireEvent.click(screen.getByText("View"));
    fireEvent.click(screen.getByText("Schedule"));
    fireEvent.click(screen.getByText("Task"));

    expect(handleView).toHaveBeenCalledWith(companion);
    expect(handleSchedule).toHaveBeenCalledWith(companion);
    expect(handleTask).toHaveBeenCalledWith(companion);
  });
});
