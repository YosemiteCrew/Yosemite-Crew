import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { CompanionProps } from "@/app/pages/Companions/types";
import CompanionFilters from "@/app/components/Filters/CompanionFilters";

const baseList: CompanionProps[] = [
  {
    image: "",
    name: "Buddy",
    breed: "Beagle",
    species: "Dog",
    parent: "Alice",
    gender: "Male",
    age: "2y",
    lastMedication: "",
    vaccineDue: "",
    upcomingAppointent: "",
    upcomingAppointentTime: "",
    status: "Active",
  },
  {
    image: "",
    name: "Misty",
    breed: "Persian",
    species: "Cat",
    parent: "Bob",
    gender: "Female",
    age: "4y",
    lastMedication: "",
    vaccineDue: "",
    upcomingAppointent: "",
    upcomingAppointentTime: "",
    status: "Inactive",
  },
  {
    image: "",
    name: "Shadow",
    breed: "Siamese",
    species: "Cat",
    parent: "Charlie",
    gender: "Male",
    age: "1y",
    lastMedication: "",
    vaccineDue: "",
    upcomingAppointent: "",
    upcomingAppointentTime: "",
    status: "Archived",
  },
];

describe("<CompanionFilters />", () => {
  test("applies default status filter on mount", async () => {
    const setFilteredList = jest.fn();
    render(
      <CompanionFilters list={baseList} setFilteredList={setFilteredList} />
    );

    await waitFor(() => expect(setFilteredList).toHaveBeenCalled());
    const lastCall =
      setFilteredList.mock.calls.at(-1)?.[0];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0].name).toBe("Buddy");
  });

  test("filters by specie, status and search input", async () => {
    const setFilteredList = jest.fn();
    render(
      <CompanionFilters list={baseList} setFilteredList={setFilteredList} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cat" }));
    fireEvent.click(screen.getByRole("button", { name: "Archived" }));
    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "Shadow" },
    });

    await waitFor(() =>
      expect(setFilteredList.mock.calls.at(-1)?.[0]).toEqual([
        expect.objectContaining({ name: "Shadow" }),
      ])
    );
  });
});
