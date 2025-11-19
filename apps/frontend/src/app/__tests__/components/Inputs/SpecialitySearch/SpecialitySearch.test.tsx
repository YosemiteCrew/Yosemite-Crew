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

import SpecialitySearch from "@/app/components/Inputs/SpecialitySearch/SpecialitySearch";

const specialities = [
  { key: "dentistry", name: "Dentistry", active: false },
  { key: "xray", name: "X-Ray", active: true },
];

describe("<SpecialitySearch />", () => {
  test("displays inactive specialities and toggles via click", () => {
    const setSpecialities = jest.fn();
    render(
      <SpecialitySearch
        specialities={specialities}
        setSpecialities={setSpecialities}
      />
    );

    const input = screen.getByPlaceholderText(
      "Search or create specialty"
    );
    fireEvent.focus(input);

    expect(screen.getByRole("button", { name: "Dentistry" })).toBeInTheDocument();
    expect(screen.queryByText("X-Ray")).not.toBeInTheDocument();

    let result: any[] | undefined;
    setSpecialities.mockImplementationOnce((updater: any) => {
      result = updater(specialities);
    });

    fireEvent.click(screen.getByRole("button", { name: "Dentistry" }));
    expect(result?.[0].active).toBe(true);
  });

  test("creates a new speciality when there is no match", async () => {
    let nextState: any[] | undefined;
    const setSpecialities = jest.fn((updater: any) => {
      if (typeof updater === "function") {
        nextState = updater(specialities);
      }
    });

    render(
      <SpecialitySearch
        specialities={specialities}
        setSpecialities={setSpecialities}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText("Search or create specialty"),
      { target: { value: "Dermatology" } }
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Add speciality/i })
      ).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add speciality/i }));
    });

    expect(nextState?.[0]).toEqual(
      expect.objectContaining({ name: "Dermatology", active: true })
    );
  });
});
