import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DashboardProfile from "@/app/components/DashboardProfile/DashboardProfile";

const usePrimaryOrgMock = jest.fn();
const usePrimaryOrgProfileMock = jest.fn();
const useAuthStoreMock = jest.fn();

jest.mock("@/app/hooks/useOrgSelectors", () => ({
  usePrimaryOrg: () => usePrimaryOrgMock(),
}));

jest.mock("@/app/hooks/useProfiles", () => ({
  usePrimaryOrgProfile: () => usePrimaryOrgProfileMock(),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: (selector: any) => selector(useAuthStoreMock()),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: () => false,
}));

describe("DashboardProfile", () => {
  beforeEach(() => {
    usePrimaryOrgProfileMock.mockReturnValue({
      personalDetails: {
        profilePictureUrl: "",
      },
    });
    useAuthStoreMock.mockReturnValue({
      attributes: { given_name: "Jamie", family_name: "Lee" },
    });
  });

  it("renders nothing when no primary org", () => {
    usePrimaryOrgMock.mockReturnValue(null);

    const { container } = render(<DashboardProfile />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders verification banner when org is not verified", () => {
    usePrimaryOrgMock.mockReturnValue({ isVerified: false });

    render(<DashboardProfile />);

    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Jamie Lee")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Verification in progress — Limited access enabled"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Book onboarding call" })
    ).toBeInTheDocument();
  });
});
