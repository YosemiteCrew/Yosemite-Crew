import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const updateOrgMock = jest.fn();

jest.mock("@/app/services/orgService", () => ({
  updateOrg: (...args: any[]) => updateOrgMock(...args),
}));

jest.mock("@/app/pages/Organization/Sections/ProfileCard", () => ({
  __esModule: true,
  default: ({ title, onSave }: any) => (
    <div>
      <div>{title}</div>
      <button type="button" onClick={() => onSave?.({ name: "New" })}>
        save-{title}
      </button>
    </div>
  ),
}));

describe("Organization Profile", () => {
  beforeAll(() => {
    (console.error as jest.Mock).mockImplementation(() => {});
  });

  it("renders profile cards and calls update on save", async () => {
    const { default: Profile } = await import(
      "@/app/pages/Organization/Sections/Profile"
    );
    const primaryOrg: any = {
      name: "Clinic",
      address: { country: "USA" },
    };

    render(<Profile primaryOrg={primaryOrg} />);

    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Address")).toBeInTheDocument();

    updateOrgMock.mockResolvedValueOnce(undefined);
    updateOrgMock.mockResolvedValueOnce(undefined);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "save-Organization" })
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "save-Address" }));
    });

    expect(updateOrgMock).toHaveBeenCalled();
  });
});
