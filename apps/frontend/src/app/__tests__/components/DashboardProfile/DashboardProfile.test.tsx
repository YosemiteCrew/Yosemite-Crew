import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import DashboardProfile from "@/app/components/DashboardProfile/DashboardProfile";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button type="button">{text}</button>,
  Secondary: ({ text }: any) => <button type="button">{text}</button>,
}));

jest.mock("@/app/hooks/useOrgSelectors", () => ({
  usePrimaryOrg: jest.fn(),
}));

jest.mock("@/app/hooks/useProfiles", () => ({
  usePrimaryOrgProfile: jest.fn(),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: (selector: any) =>
    selector({ attributes: { given_name: "Alex", family_name: "Lee" } }),
}));

jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: jest.fn(() => true),
}));

import { usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import { usePrimaryOrgProfile } from "@/app/hooks/useProfiles";

describe("DashboardProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue({
      personalDetails: { profilePictureUrl: "https://example.com/avatar.png" },
    });
  });

  it("returns null when no primary org", () => {
    (usePrimaryOrg as jest.Mock).mockReturnValue(null);
    const { container } = render(<DashboardProfile />);
    expect(container.firstChild).toBeNull();
  });

  it("renders verified state actions", () => {
    (usePrimaryOrg as jest.Mock).mockReturnValue({
      _id: "org-1",
      isVerified: true,
    });

    render(<DashboardProfile />);

    expect(screen.getAllByText("Setup stripe").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Add services").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Invite team").length).toBeGreaterThan(0);
    expect(screen.getByText("Alex Lee")).toBeInTheDocument();
  });

  it("renders unverified state notice", () => {
    (usePrimaryOrg as jest.Mock).mockReturnValue({
      _id: "org-1",
      isVerified: false,
    });

    render(<DashboardProfile />);

    expect(
      screen.getByText("Verification in progress — Limited access enabled")
    ).toBeInTheDocument();
    expect(screen.getByText("Book onboarding call")).toBeInTheDocument();
  });
});
