import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ServiceSearch from "@/app/components/Inputs/ServiceSearch/ServiceSearch";

const speciality = {
  key: "surgery",
  services: [
    { name: "Dental Cleaning", active: false },
    { name: "Emergency Care", active: true },
  ],
};

describe("ServiceSearch", () => {
  test("filters services and toggles selections", () => {
    const handleToggle = jest.fn();
    render(
      <ServiceSearch
        speciality={speciality}
        setSpecialities={jest.fn()}
        handleToggle={handleToggle}
      />
    );

    const input = screen.getByPlaceholderText("Search or create service");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Dental" } });

    const checkbox = screen.getByLabelText("Dental Cleaning");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);

    expect(handleToggle).toHaveBeenCalledWith("Dental Cleaning", true);
  });

  test("adds a new service when none matches the query", () => {
    const setSpecialities = jest.fn();
    render(
      <ServiceSearch
        speciality={speciality}
        setSpecialities={setSpecialities}
        handleToggle={jest.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Search or create service");
    fireEvent.change(input, { target: { value: "Hydrotherapy" } });

    const addButton = screen.getByRole("button", { name: /Add service/ });
    fireEvent.click(addButton);

    expect(setSpecialities).toHaveBeenCalled();
    expect(typeof setSpecialities.mock.calls[0][0]).toBe("function");
  });
});
