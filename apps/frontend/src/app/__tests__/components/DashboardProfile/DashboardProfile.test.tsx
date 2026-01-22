import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import DashboardProfile from "@/app/components/DashboardProfile/DashboardProfile";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt || ""} {...props} />,
}));

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
  useAuthStore: (selector: any) => useAuthStoreMock(selector),
}));

jest.mock("@/app/utils/urls", () => ({
  getSafeImageUrl: jest.fn(() => "image"),
}));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button type="button">{text}</button>,
}));

describe("DashboardProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders null when no primary org", () => {
    usePrimaryOrgMock.mockReturnValue(null);

    const { container } = render(<DashboardProfile />);
    expect(container.firstChild).toBeNull();
  });

  it("shows welcome text and onboarding notice for unverified org", () => {
    usePrimaryOrgMock.mockReturnValue({ _id: "org1", isVerified: false });
    usePrimaryOrgProfileMock.mockReturnValue({
      personalDetails: { profilePictureUrl: "photo" },
    });
    useAuthStoreMock.mockReturnValue({
      given_name: "Alex",
      family_name: "Johnson",
    });

    render(<DashboardProfile />);

    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Alex Johnson")).toBeInTheDocument();
    expect(
      screen.getByText("Verification in progress — Limited access enabled")
    ).toBeInTheDocument();
    expect(screen.getByText("Book onboarding call")).toBeInTheDocument();
    expect(screen.getByText(/Note/)).toBeInTheDocument();
  });

  it("does not show onboarding notice when verified", () => {
    usePrimaryOrgMock.mockReturnValue({ _id: "org1", isVerified: true });
    usePrimaryOrgProfileMock.mockReturnValue({
      personalDetails: { profilePictureUrl: "photo" },
    });
    useAuthStoreMock.mockReturnValue({
      given_name: "Alex",
      family_name: "Johnson",
    });

    render(<DashboardProfile />);

    expect(
      screen.queryByText("Verification in progress — Limited access enabled")
    ).not.toBeInTheDocument();
  });
});
