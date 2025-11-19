import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import "../../../../jest.mocks/testMocks";

import ServiceSearch from "@/app/components/Inputs/ServiceSearch/ServiceSearch";

const speciality = {
  key: "dental",
  services: [
    { name: "Exam", active: false },
    { name: "Surgery", active: true },
  ],
};

describe("<ServiceSearch />", () => {
  test("lists only inactive services and toggles selection", () => {
    const handleToggle = jest.fn();
    const setSpecialities = jest.fn();

    render(
      <ServiceSearch
        speciality={speciality}
        setSpecialities={setSpecialities}
        handleToggle={handleToggle}
      />
    );

    const input = screen.getByPlaceholderText("Search or create service");
    fireEvent.focus(input);
    expect(screen.getByRole("button", { name: "Exam" })).toBeInTheDocument();
    expect(screen.queryByText("Surgery")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exam" }));
    expect(handleToggle).toHaveBeenCalledWith("Exam");
  });

  test("adds new service when no match exists", async () => {
    let updaterResult: any[] | undefined;
    const setSpecialities = jest.fn((updater: any) => {
      if (typeof updater === "function") {
        updaterResult = updater([speciality]);
      }
    });

    render(
      <ServiceSearch
        speciality={speciality}
        setSpecialities={setSpecialities}
        handleToggle={jest.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Search or create service");
    fireEvent.change(input, { target: { value: "Teeth cleaning" } });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Add service/i })
      ).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add service/i }));
    });

    expect(setSpecialities).toHaveBeenCalled();
    expect(updaterResult?.[0].services[0]).toEqual(
      expect.objectContaining({ name: "Teeth cleaning", active: true })
    );
  });
});
