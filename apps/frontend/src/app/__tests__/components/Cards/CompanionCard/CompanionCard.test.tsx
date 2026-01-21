/* eslint-disable @next/next/no-img-element */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompanionCard from "@/app/components/Cards/CompanionCard/CompanionCard";

jest.mock("@/app/utils/date", () => ({
  getAgeInYears: () => "2y",
}));

jest.mock("@/app/utils/urls", () => ({
  getSafeImageUrl: () => "https://example.com/pet.png",
}));

jest.mock("@/app/utils/validators", () => ({
  toTitleCase: (value: string) => value,
}));

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

describe("CompanionCard", () => {
  it("renders details and handles actions", () => {
    const handleView = jest.fn();
    const handleBook = jest.fn();
    const handleTask = jest.fn();
    const companion: any = {
      companion: {
        name: "Buddy",
        breed: "Lab",
        type: "dog",
        gender: "male",
        dateOfBirth: new Date(),
        allergy: "None",
        status: "active",
        photoUrl: "",
      },
      parent: { firstName: "Jordan" },
    };

    render(
      <CompanionCard
        companion={companion}
        handleViewCompanion={handleView}
        handleBookAppointment={handleBook}
        handleAddTask={handleTask}
      />
    );

    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("Lab / dog")).toBeInTheDocument();
    expect(screen.getByText("Jordan")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    fireEvent.click(screen.getByRole("button", { name: "Task" }));

    expect(handleView).toHaveBeenCalledWith(companion);
    expect(handleBook).toHaveBeenCalledWith(companion);
    expect(handleTask).toHaveBeenCalledWith(companion);
  });
});
