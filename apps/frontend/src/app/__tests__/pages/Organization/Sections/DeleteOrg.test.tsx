import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DeleteOrg from "@/app/pages/Organization/Sections/DeleteOrg";

const deleteOrgMock = jest.fn();

jest.mock("@/app/services/orgService", () => ({
  deleteOrg: () => deleteOrgMock(),
}));

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Buttons/Delete", () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
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

describe("DeleteOrg", () => {
  it("shows validation error when email is missing", () => {
    render(<DeleteOrg />);

    fireEvent.click(screen.getByRole("button", { name: "Delete organization" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });

  it("calls deleteOrg when email is provided", () => {
    render(<DeleteOrg />);

    fireEvent.click(screen.getByRole("button", { name: "Delete organization" }));
    fireEvent.change(screen.getByLabelText("Enter email address"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleteOrgMock).toHaveBeenCalled();
  });
});
