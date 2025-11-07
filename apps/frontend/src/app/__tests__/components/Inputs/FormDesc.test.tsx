import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";

describe("FormDesc", () => {
  test("renders textarea with label", () => {
    render(
      <FormDesc
        intype="text"
        inname="bio"
        inlabel="Biography"
        value="Vet with 10 years of experience"
        onChange={jest.fn()}
      />
    );

    const textarea = screen.getByLabelText<HTMLTextAreaElement>("Biography");
    expect(textarea.value).toBe("Vet with 10 years of experience");
  });

  test("calls onChange with new value", () => {
    let seen: string | null = null;
    const handleChange = jest.fn(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        // Read immediately while the handler runs
        seen = e.target.value; // or e.currentTarget.value
      }
    );

    render(
      <FormDesc
        intype="text"
        inname="bio"
        inlabel="Biography"
        value=""
        onChange={handleChange}
      />
    );

    const textarea = screen.getByLabelText<HTMLTextAreaElement>("Biography");
    fireEvent.change(textarea, { target: { value: "New bio" } });

    expect(handleChange).toHaveBeenCalled();
    expect(seen).toBe("New bio");
  });

  test("displays error text", () => {
    render(
      <FormDesc
        intype="text"
        inname="bio"
        inlabel="Biography"
        value=""
        onChange={jest.fn()}
        error="Description required"
      />
    );

    expect(screen.getByText("Description required")).toBeInTheDocument();
  });
});
