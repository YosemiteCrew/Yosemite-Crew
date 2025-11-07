import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import SpecialitySearch from "@/app/components/Inputs/SpecialitySearch/SpecialitySearch";

const specialities = [
  { name: "Dentistry", key: "dentistry", active: true, services: [] },
  { name: "Surgery", key: "surgery", active: false, services: [] },
];

describe("SpecialitySearch", () => {
  test("toggles speciality selection", () => {
    const setSpecialities = jest.fn();
    render(
      <SpecialitySearch
        specialities={specialities}
        setSpecialities={setSpecialities}
      />
    );

    const input = screen.getByPlaceholderText("Search or create specialty");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Surg" } });

    const checkbox = screen.getByLabelText("Surgery");
    fireEvent.click(checkbox);

    expect(setSpecialities).toHaveBeenCalled();
    expect(typeof setSpecialities.mock.calls[0][0]).toBe("function");
  });

  test("adds new speciality when search has no match", () => {
    const setSpecialities = jest.fn();
    render(
      <SpecialitySearch
        specialities={specialities}
        setSpecialities={setSpecialities}
      />
    );

    const input = screen.getByPlaceholderText("Search or create specialty");
    fireEvent.change(input, { target: { value: "Neurology" } });

    const button = screen.getByRole("button", { name: /Add speciality/ });
    fireEvent.click(button);

    expect(setSpecialities).toHaveBeenCalled();
    expect(typeof setSpecialities.mock.calls[0][0]).toBe("function");
  });
});
