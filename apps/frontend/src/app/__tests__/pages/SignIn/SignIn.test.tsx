import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import SignIn from "@/app/pages/SignIn/SignIn";
import { useAuthStore } from "@/app/stores/authStore";
import { useRouter } from "next/navigation";
import { useErrorTost } from "@/app/components/Toast/Toast";

// --- Mocks ---

// Mock Next.js Navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock Auth Store
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

// Mock Toast
jest.mock("@/app/components/Toast/Toast", () => ({
  useErrorTost: jest.fn(),
}));

// Mock Components
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, error, inlabel }: any) => (
    <div data-testid="email-input-wrapper">
      <label>{inlabel}</label>
      <input data-testid="email-input" value={value} onChange={onChange} />
      {error && <span data-testid="email-error">{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInputPass/FormInputPass", () => ({
  __esModule: true,
  default: ({ value, onChange, error, inlabel }: any) => (
    <div data-testid="password-input-wrapper">
      <label>{inlabel}</label>
      <input
        data-testid="password-input"
        value={value}
        onChange={onChange}
        type="password"
      />
      {error && <span data-testid="password-error">{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/OtpModal/OtpModal", () => ({
  __esModule: true,
  default: ({ showVerifyModal }: any) =>
    showVerifyModal ? <div data-testid="otp-modal">OTP Modal Open</div> : null,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="signin-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

// Mock Storage
const mockSessionStorage = {
  setItem: jest.fn(),
};
Object.defineProperty(globalThis, "sessionStorage", {
  value: mockSessionStorage,
});
Object.defineProperty(globalThis, "scrollTo", {
  value: jest.fn(),
});

describe("SignIn Page", () => {
  const mockSignIn = jest.fn();
  const mockResendCode = jest.fn();
  const mockRouterPush = jest.fn();
  const mockShowErrorTost = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      resendCode: mockResendCode,
    });

    (useRouter as jest.Mock).mockReturnValue({
      push: mockRouterPush,
    });

    (useErrorTost as jest.Mock).mockReturnValue({
      showErrorTost: mockShowErrorTost,
      ErrorTostPopup: <div data-testid="toast-popup" />,
    });
  });

  // --- 1. Rendering ---

  it("renders the sign-in form correctly (default mode)", () => {
    render(<SignIn />);

    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    expect(screen.getByTestId("email-input")).toBeInTheDocument();
    expect(screen.getByTestId("password-input")).toBeInTheDocument();
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
    expect(screen.getByTestId("signin-btn")).toBeInTheDocument();
    expect(screen.getByText("Sign up")).toHaveAttribute("href", "/signup");
  });

  it("renders correctly in developer mode", () => {
    render(<SignIn isDeveloper={true} signupHref="/dev-signup" />);

    expect(
      screen.getByText("Sign in to your developer account")
    ).toBeInTheDocument();
    // Check background style application (indirectly via class or structure implies it handled props)
    const section = screen.getByTestId("signin-btn").closest("section");
    expect(section).toHaveStyle(
      `background-image: linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.55)), url("/assets/bgDev.jpg")`
    );
    expect(screen.getByText("Sign up")).toHaveAttribute("href", "/dev-signup");
  });

  // --- 2. Input & Validation ---

  it("updates state on input change", () => {
    render(<SignIn />);

    const emailInput = screen.getByTestId("email-input");
    const passInput = screen.getByTestId("password-input");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passInput, { target: { value: "password123" } });

    expect(emailInput).toHaveValue("test@example.com");
    expect(passInput).toHaveValue("password123");
  });

  it("shows validation errors when fields are empty", () => {
    render(<SignIn />);

    fireEvent.click(screen.getByTestId("signin-btn"));

    expect(screen.getByTestId("email-error")).toHaveTextContent(
      "Email is required"
    );
    expect(screen.getByTestId("password-error")).toHaveTextContent(
      "Password is required"
    );
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  // --- 3. Success Flow ---

  it("calls signIn and redirects on success", async () => {
    mockSignIn.mockResolvedValue({}); // Success

    render(<SignIn />);

    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "pass123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("signin-btn"));
    });

    expect(mockSignIn).toHaveBeenCalledWith("test@example.com", "pass123");
    expect(mockRouterPush).toHaveBeenCalledWith("/organizations");
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith("devAuth", "false");
  });

  it("sets devAuth to true in storage when isDeveloper is true", async () => {
    mockSignIn.mockResolvedValue({});

    render(<SignIn isDeveloper={true} />);

    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "dev@example.com" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "pass123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("signin-btn"));
    });

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith("devAuth", "true");
  });

  // --- 4. Error Handling & Edge Cases ---

  it("handles generic sign-in error", async () => {
    mockSignIn.mockRejectedValue(new Error("Invalid credentials"));

    render(<SignIn />);

    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "pass123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("signin-btn"));
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Invalid credentials",
        errortext: "Error",
      })
    );
  });

  it("handles UserNotConfirmedException by resending code and showing modal", async () => {
    const error = { code: "UserNotConfirmedException" };
    mockSignIn.mockRejectedValue(error);
    mockResendCode.mockResolvedValue(true);

    render(<SignIn />);

    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "unconfirmed@test.com" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "pass123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("signin-btn"));
    });

    expect(mockResendCode).toHaveBeenCalledWith("unconfirmed@test.com");
    // Wait for state update to show modal (OtpModal mock renders based on showVerifyModal prop)
    expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
  });

  it("handles error during resend code (UserNotConfirmed flow)", async () => {
    const error = { code: "UserNotConfirmedException" };
    mockSignIn.mockRejectedValue(error);
    mockResendCode.mockRejectedValue(new Error("Resend failed"));

    render(<SignIn />);

    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "unconfirmed@test.com" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "pass123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("signin-btn"));
    });

    expect(mockResendCode).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Resend failed",
      })
    );
    // Modal should not open on resend failure
    expect(screen.queryByTestId("otp-modal")).not.toBeInTheDocument();
  });

  it("uses default error message if error object has no message", async () => {
    mockSignIn.mockRejectedValue({}); // No message

    render(<SignIn />);

    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "t@t.com" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "p" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("signin-btn"));
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sign in failed" })
    );
  });

  it("uses default error message for resend failure", async () => {
    const error = { code: "UserNotConfirmedException" };
    mockSignIn.mockRejectedValue(error);
    mockResendCode.mockRejectedValue({}); // No message

    render(<SignIn />);

    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "t@t.com" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "p" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("signin-btn"));
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Error resending code." })
    );
  });
});
