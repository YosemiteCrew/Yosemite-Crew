import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import DeleteOrg from "@/app/pages/Organization/Sections/DeleteOrg";

const deleteOrgMock = jest.fn();

jest.mock("@/app/services/orgService", () => ({
  deleteOrg: () => deleteOrgMock(),
}));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
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

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => (props: any) => (
  <input aria-label={props.inlabel} value={props.value} onChange={props.onChange} />
));

jest.mock("@/app/components/Modal/CenterModal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

describe("DeleteOrg section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deleteOrgMock.mockResolvedValue(undefined);
  });

  it("opens modal and deletes when email is provided", async () => {
    render(<DeleteOrg />);

    fireEvent.click(screen.getByText("Delete organization"));
    fireEvent.change(screen.getByLabelText("Enter email address"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByText("Delete"));

    expect(deleteOrgMock).toHaveBeenCalled();
  });
});
