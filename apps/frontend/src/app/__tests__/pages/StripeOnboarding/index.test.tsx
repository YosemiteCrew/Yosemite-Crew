import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ProtectedStripeOnboarding from "@/app/pages/StripeOnboarding/index";
import { useStripeOnboarding } from "@/app/hooks/useStripeOnboarding";
import {
  createConnectedAccount,
  onBoardConnectedAccount,
} from "@/app/services/stripeService";
import { useRouter, useSearchParams } from "next/navigation";
import { loadConnectAndInitialize } from "@stripe/connect-js";

// --- Mocks ---

const ORIGINAL_ENV = process.env;
beforeAll(() => {
  process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_SANDBOX_PUBLISH: "pk_test_123" };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("@/app/hooks/useStripeOnboarding", () => ({
  useStripeOnboarding: jest.fn(),
}));

jest.mock("@/app/services/stripeService", () => ({
  createConnectedAccount: jest.fn(),
  onBoardConnectedAccount: jest.fn(),
}));

jest.mock("@stripe/connect-js", () => ({
  loadConnectAndInitialize: jest.fn(),
}));
jest.mock("@stripe/react-connect-js", () => ({
  ConnectComponentsProvider: ({ children }: any) => (
    <div data-testid="connect-provider">{children}</div>
  ),
  ConnectAccountOnboarding: ({ onExit }: any) => (
    <div data-testid="connect-onboarding">
      <span>Onboarding Component</span>
      <button onClick={onExit} data-testid="exit-btn">
        Exit
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

describe("StripeOnboarding Page", () => {
  const mockRouter = { push: jest.fn() };
  const mockSearchParams = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    mockSearchParams.get.mockReturnValue("org-123");
  });

  // --- 1. Initial Checks & Redirects ---

  it("redirects to /organizations if onboarding is not required", () => {
    (useStripeOnboarding as jest.Mock).mockReturnValue({ onboard: false });

    render(<ProtectedStripeOnboarding />);

    // FIX: The OrgGuard div will exist, but should be empty because StripeOnboarding returned null
    expect(screen.getByTestId("org-guard")).toBeEmptyDOMElement();

    expect(createConnectedAccount).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith("/organizations");
  });

  it("attempts to create account if onboarding is required", async () => {
    (useStripeOnboarding as jest.Mock).mockReturnValue({ onboard: true });
    (createConnectedAccount as jest.Mock).mockResolvedValue("acct_123");

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => {
      expect(createConnectedAccount).toHaveBeenCalledWith("org-123");
    });
  });

  // --- 2. Account Creation Logic ---

  it("redirects to /dashboard if account creation fails/returns no ID", async () => {
    (useStripeOnboarding as jest.Mock).mockReturnValue({ onboard: true });
    (createConnectedAccount as jest.Mock).mockResolvedValue(null);

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("logs error if createConnectedAccount throws", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (useStripeOnboarding as jest.Mock).mockReturnValue({ onboard: true });
    (createConnectedAccount as jest.Mock).mockRejectedValue(
      new Error("API Error")
    );

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  // --- 3. Stripe Instance Initialization ---

  it("initializes Stripe Connect instance when accountId is set", async () => {
    (useStripeOnboarding as jest.Mock).mockReturnValue({ onboard: true });
    (createConnectedAccount as jest.Mock).mockResolvedValue("acct_123");
    (onBoardConnectedAccount as jest.Mock).mockResolvedValue(
      "client_secret_abc"
    );
    (loadConnectAndInitialize as jest.Mock).mockReturnValue({ instance: true });

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => expect(createConnectedAccount).toHaveBeenCalled());

    await waitFor(() => {
      expect(loadConnectAndInitialize).toHaveBeenCalledWith(
        expect.objectContaining({
          publishableKey: "pk_test_123",
          fetchClientSecret: expect.any(Function),
        })
      );
    });

    const initCall = (loadConnectAndInitialize as jest.Mock).mock.calls[0][0];
    const secret = await initCall.fetchClientSecret();
    expect(onBoardConnectedAccount).toHaveBeenCalledWith("org-123");
    expect(secret).toBe("client_secret_abc");
  });

  // --- 4. Rendering UI & Exit Flow ---

  it("renders the Stripe UI components when instance is ready", async () => {
    (useStripeOnboarding as jest.Mock).mockReturnValue({ onboard: true });
    (createConnectedAccount as jest.Mock).mockResolvedValue("acct_123");
    (loadConnectAndInitialize as jest.Mock).mockReturnValue({ instance: true });

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => {
      expect(screen.getByText("Stripe Onboarding")).toBeInTheDocument();
      expect(screen.getByTestId("connect-provider")).toBeInTheDocument();
    });
  });

  it("redirects to dashboard when user exits onboarding", async () => {
    (useStripeOnboarding as jest.Mock).mockReturnValue({ onboard: true });
    (createConnectedAccount as jest.Mock).mockResolvedValue("acct_123");
    (loadConnectAndInitialize as jest.Mock).mockReturnValue({ instance: true });

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => {
      expect(screen.getByTestId("exit-btn")).toBeInTheDocument();
    });

    screen.getByTestId("exit-btn").click();
    expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
  });
});
