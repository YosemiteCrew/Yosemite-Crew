import React from "react";
import { render, screen } from "@testing-library/react";
import DashboardProfile from "@/app/components/DashboardProfile/DashboardProfile";

// --- Mocks ---

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, href, className }: any) => (
    <a href={href} className={className} data-testid="primary-btn">
      {text}
    </a>
  ),
  Secondary: ({ text, href, className }: any) => (
    <a href={href} className={className} data-testid="secondary-btn">
      {text}
    </a>
  ),
}));

jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: jest.fn(),
}));

jest.mock("react-icons/fa6", () => ({
  FaClock: () => <span data-testid="fa-clock-icon" />,
}));

const mockUsePrimaryOrg = jest.fn();
const mockUsePrimaryOrgProfile = jest.fn();
const mockUseAuthStore = jest.fn();

jest.mock("@/app/hooks/useOrgSelectors", () => ({
  usePrimaryOrg: () => mockUsePrimaryOrg(),
}));

jest.mock("@/app/hooks/useProfiles", () => ({
  usePrimaryOrgProfile: () => mockUsePrimaryOrgProfile(),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: (selector: any) =>
    mockUseAuthStore(selector) || selector({ attributes: {} }),
}));

import { isHttpsImageUrl } from "@/app/utils/urls";

describe("DashboardProfile Component", () => {
  const mockAttributes = {
    given_name: "John",
    family_name: "Doe",
  };

  const mockProfile = {
    personalDetails: {
      profilePictureUrl: "https://example.com/me.jpg",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ attributes: mockAttributes })
    );
    mockUsePrimaryOrgProfile.mockReturnValue(mockProfile);
    (isHttpsImageUrl as unknown as jest.Mock).mockReturnValue(true);
  });

  // --- 1. Basic Rendering & Null State ---

  it("renders nothing if no primary organization exists", () => {
    mockUsePrimaryOrg.mockReturnValue(null);
    const { container } = render(<DashboardProfile />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders basic profile info correctly", () => {
    mockUsePrimaryOrg.mockReturnValue({ _id: "org-1", isVerified: true });

    render(<DashboardProfile />);

    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(
      screen.getByText(/Your central hub for insights/)
    ).toBeInTheDocument();

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/me.jpg");
  });

  // --- 2. Verified Org State ---

  it("renders Verified UI elements correctly", () => {
    mockUsePrimaryOrg.mockReturnValue({ _id: "org-123", isVerified: true });

    render(<DashboardProfile />);

    expect(screen.getByText("Setup stripe payment")).toBeInTheDocument();
    expect(screen.getByText("Add specialities & services")).toBeInTheDocument();
    expect(screen.getByText("Invite team members")).toBeInTheDocument();

    const setupBtn = screen.getByText("Setup stripe");
    expect(setupBtn).toBeInTheDocument();
    expect(setupBtn).toHaveAttribute(
      "href",
      "/stripe-onboarding?orgId=org-123"
    );

    const addServicesBtn = screen.getByText("Add services");
    expect(addServicesBtn).toHaveAttribute("href", "/organization");

    const inviteBtn = screen.getByText("Invite team");
    expect(inviteBtn).toHaveAttribute("href", "/organization");

    expect(
      screen.getByText(/Stripe is needed to receive payments/)
    ).toBeInTheDocument();
  });

  // --- 3. Unverified (Pending) Org State ---

  it("renders Unverified (Pending) UI elements correctly", () => {
    mockUsePrimaryOrg.mockReturnValue({ _id: "org-456", isVerified: false });

    render(<DashboardProfile />);

    const statusTexts = screen.getAllByText(/Verification in progress/);
    expect(statusTexts.length).toBeGreaterThan(0);

    const bookBtn = screen.getByText("Book onboarding call");
    expect(bookBtn).toBeInTheDocument();
    expect(bookBtn).toHaveAttribute("href", "/book-onboarding");

    expect(
      screen.getByText(/This short chat helps us confirm your business/)
    ).toBeInTheDocument();
  });

  // --- 4. Edge Cases ---

  it("uses fallback image if profile picture is invalid", () => {
    mockUsePrimaryOrg.mockReturnValue({ _id: "org-1", isVerified: true });
    (isHttpsImageUrl as unknown as jest.Mock).mockReturnValue(false);

    render(<DashboardProfile />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
    );
  });

  it("handles missing name attributes gracefully", () => {
    mockUsePrimaryOrg.mockReturnValue({ _id: "org-1", isVerified: true });
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ attributes: {} })
    );

    render(<DashboardProfile />);

    const heading = document.querySelector(".dashboard-profile-heading");
    expect(heading).toBeInTheDocument();
    // FIX: Check innerHTML to verify the space is rendered
    expect(heading?.innerHTML).toBe(" ");
  });
});
