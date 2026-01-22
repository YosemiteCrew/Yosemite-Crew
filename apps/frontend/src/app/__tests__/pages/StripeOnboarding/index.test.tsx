import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import ProtectedStripeOnboarding from "@/app/pages/StripeOnboarding";

const pushMock = jest.fn();
const useStripeOnboardingMock = jest.fn();
const useStripeStatusMock = jest.fn();
const useSubscriptionMock = jest.fn();
const createAccountMock = jest.fn();
const onboardAccountMock = jest.fn();
const loadConnectMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: () => "org-1" }),
}));

jest.mock("@/app/hooks/useStripeOnboarding", () => ({
  useStripeOnboarding: (...args: any[]) => useStripeOnboardingMock(...args),
  useStripeAccountStatus: () => ({ refetch: useStripeStatusMock }),
}));

jest.mock("@/app/hooks/useBilling", () => ({
  useSubscriptionByOrgId: () => useSubscriptionMock(),
}));

jest.mock("@/app/services/stripeService", () => ({
  createConnectedAccount: (...args: any[]) => createAccountMock(...args),
  onBoardConnectedAccount: (...args: any[]) => onboardAccountMock(...args),
}));

jest.mock("@stripe/connect-js", () => ({
  loadConnectAndInitialize: (...args: any[]) => loadConnectMock(...args),
}));

jest.mock("@stripe/react-connect-js", () => ({
  ConnectComponentsProvider: ({ children }: any) => (
    <div data-testid="connect-provider">{children}</div>
  ),
  ConnectAccountOnboarding: () => <div data-testid="connect-onboarding" />,
}));

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

describe("Stripe onboarding page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SANDBOX_PUBLISH = "pk_test";
    useStripeStatusMock.mockResolvedValue(undefined);
  });

  it("returns null when onboarding is disabled", () => {
    useStripeOnboardingMock.mockReturnValue({ onboard: false });
    useSubscriptionMock.mockReturnValue(null);

    const { container } = render(<ProtectedStripeOnboarding />);
    expect(screen.queryByText("Stripe Onboarding")).not.toBeInTheDocument();
  });

  it("redirects when subscription already connected", async () => {
    useStripeOnboardingMock.mockReturnValue({ onboard: true });
    useSubscriptionMock.mockReturnValue({
      connectChargesEnabled: true,
      connectAccountId: "acct_1",
    });

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("renders connect onboarding when instance is created", async () => {
    useStripeOnboardingMock.mockReturnValue({ onboard: true });
    useSubscriptionMock.mockReturnValue({
      connectChargesEnabled: false,
      connectAccountId: "acct_1",
    });
    onboardAccountMock.mockResolvedValue("secret");
    loadConnectMock.mockReturnValue({});

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => {
      expect(loadConnectMock).toHaveBeenCalled();
    });

    expect(screen.getByTestId("connect-provider")).toBeInTheDocument();
    expect(screen.getByTestId("connect-onboarding")).toBeInTheDocument();
  });
});
