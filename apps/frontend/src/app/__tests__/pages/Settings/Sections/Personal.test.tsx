import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Personal from "@/app/pages/Settings/Sections/Personal";

const useAuthStoreMock = jest.fn();

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: (selector: any) => selector(useAuthStoreMock()),
}));

jest.mock("@/app/pages/Organization/Sections/ProfileCard", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

describe("Settings Personal section", () => {
  it("renders nothing without attributes", () => {
    useAuthStoreMock.mockReturnValue({ attributes: null });

    const { container } = render(<Personal />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders profile card when attributes exist", () => {
    useAuthStoreMock.mockReturnValue({
      attributes: { given_name: "Taylor", family_name: "Fox" },
    });

    render(<Personal />);

    expect(screen.getByText("Personal details")).toBeInTheDocument();
  });
});
