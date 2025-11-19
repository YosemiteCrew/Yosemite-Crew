import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import "@/app/jest.mocks/testMocks";

import CompanionCard from "@/app/components/Cards/CompanionCard/CompanionCard";

const companion = {
  image: "/pet.png",
  name: "Bolt",
  breed: "Beagle",
  species: "Dog",
  parent: "Tom",
  gender: "Male",
  age: "3y",
  lastMedication: "Heartworm",
  vaccineDue: "2025-02-03",
  upcomingAppointent: "Mar 20",
  upcomingAppointentTime: "12:00",
  status: "active",
};

describe("<CompanionCard />", () => {
  test("shows key details and status pill", () => {
    render(<CompanionCard companion={companion} />);

    expect(screen.getByText("Bolt")).toBeInTheDocument();
    expect(screen.getByText("Beagle / Dog")).toBeInTheDocument();
    expect(screen.getByText("Tom")).toBeInTheDocument();
    expect(screen.getByText("Male - 3y")).toBeInTheDocument();
    expect(screen.getByText("Heartworm")).toBeInTheDocument();
    expect(
      screen.getByText("Mar 20 12:00", { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
