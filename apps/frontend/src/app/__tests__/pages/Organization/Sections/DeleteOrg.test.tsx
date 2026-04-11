import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import DeleteOrg from "@/app/features/organization/pages/Organization/Sections/DeleteOrg";

const deleteOrgMock = jest.fn();

jest.mock("@/app/features/organization/services/orgService", () => ({
  deleteOrg: () => deleteOrgMock(),
}));

jest.mock("@/app/ui/layout/guards/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

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

jest.mock("@/app/ui/inputs/FormInput/FormInput", () => (props: any) => (
  <input aria-label={props.inlabel} value={props.value} onChange={props.onChange} />
));

jest.mock("@/app/ui/overlays/Modal/CenterModal", () => ({
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

    fireEvent.click(screen.getAllByText("Delete organization")[0]);
    fireEvent.change(screen.getByLabelText("Enter email address"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByText("Delete"));

    expect(deleteOrgMock).toHaveBeenCalled();
  });
});
