import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DeleteProfile from "@/app/features/settings/pages/Settings/Sections/DeleteProfile";

jest.mock("@/app/ui/primitives/Buttons", () => ({
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/ui/primitives/Buttons/Delete", () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/ui/primitives/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock("@/app/ui/inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, inlabel, onChange, error }: any) => (
    <div>
      <label>
        {inlabel}
        <input value={value} onChange={onChange} />
      </label>
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

describe("Settings DeleteProfile", () => {
  it("opens modal and validates required email", () => {
    render(<DeleteProfile />);

    fireEvent.click(screen.getByRole("button", { name: "Delete profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });
});
