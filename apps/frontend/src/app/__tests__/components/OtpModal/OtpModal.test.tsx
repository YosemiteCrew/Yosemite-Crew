import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import OtpModal from "@/app/components/OtpModal/OtpModal";
import { useAuthStore } from "@/app/stores/authStore";
import { useSignOut } from "@/app/hooks/useAuth";
import { useRouter } from "next/navigation";
import { postData } from "@/app/services/axios";

// --- Mocks ---

// Mock Next.js Router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock Axios
jest.mock("@/app/services/axios", () => ({
  postData: jest.fn(),
}));

// Mock Auth Store
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

// Mock useAuth Hook
jest.mock("@/app/hooks/useAuth", () => ({
  useSignOut: jest.fn(),
}));

// Mock Iconify
jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="mock-icon" />,
}));

describe("OtpModal Component", () => {
  const mockShowErrorTost = jest.fn();
  const mockSetShowVerifyModal = jest.fn();
  const mockConfirmSignUp = jest.fn();
  const mockResendCode = jest.fn();
  const mockSignIn = jest.fn();
  const mockSignOut = jest.fn();
  const mockPush = jest.fn();

  const defaultProps = {
    email: "test@example.com",
    password: "password123",
    showErrorTost: mockShowErrorTost,
    showVerifyModal: true,
    setShowVerifyModal: mockSetShowVerifyModal,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    window.scrollTo = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      confirmSignUp: mockConfirmSignUp,
      resendCode: mockResendCode,
      signIn: mockSignIn,
    });
    (useSignOut as jest.Mock).mockReturnValue({
      signOut: mockSignOut,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- 1. Rendering & Timer Tests ---

  it("renders the modal with correct email and initial state", () => {
    render(<OtpModal {...defaultProps} />);

    expect(screen.getByText("Verify Email Address")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(screen.getByText("Verify Code")).toBeInTheDocument();
    expect(screen.getByText("02:30 sec")).toBeInTheDocument();
  });

  it("does not render when showVerifyModal is false", () => {
    render(<OtpModal {...defaultProps} showVerifyModal={false} />);
    expect(screen.queryByText("Verify Email Address")).not.toBeInTheDocument();
  });

  it("decrements the timer correctly", () => {
    render(<OtpModal {...defaultProps} />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("02:29 sec")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(60000); // 1 minute
    });
    expect(screen.getByText("01:29 sec")).toBeInTheDocument();
  });

  it("disables verify button and stops timer when it reaches 0", () => {
    render(<OtpModal {...defaultProps} />);

    act(() => {
      jest.advanceTimersByTime(151000); // > 150 seconds
    });

    expect(screen.getByText("Code expired")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /Verify Code/i });
    expect(button).toBeDisabled();
  });

  // --- 2. Input Handling Logic ---

  it("handles digit input and moves focus to next input", () => {
    render(<OtpModal {...defaultProps} />);
    // FIX: Use Generic <HTMLInputElement> instead of 'as' assertion
    let inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    // Type '1' in first input
    fireEvent.change(inputs[0], { target: { value: "1" } });

    // Re-query inputs because key prop change causes remount
    inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    // Logic Check: Focus moved to index 1
    expect(inputs[1]).toHaveFocus();

    // Type '2' in second input
    fireEvent.change(inputs[1], { target: { value: "2" } });

    inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    // Logic Check: Focus moved to index 2
    expect(inputs[2]).toHaveFocus();
  });

  it("ignores non-digit input", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    fireEvent.change(inputs[0], { target: { value: "a" } });

    // Logic Check: Value remains empty
    expect(inputs[0]).toHaveValue("");
  });

  it("handles Backspace: clears current input if filled", () => {
    render(<OtpModal {...defaultProps} />);
    let inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    // Fill first one
    fireEvent.change(inputs[0], { target: { value: "1" } });

    // Re-query
    inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    // Hit backspace on first one
    fireEvent.keyDown(inputs[0], { key: "Backspace" });

    // Re-query again
    inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    // Logic Check: Input is cleared
    expect(inputs[0]).toHaveValue("");
  });

  it("handles Backspace: moves to previous input if current is empty", () => {
    render(<OtpModal {...defaultProps} />);
    let inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    // Focus 2nd input by typing in 1st
    fireEvent.change(inputs[0], { target: { value: "1" } });

    inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    expect(inputs[1]).toHaveFocus();

    // Backspace on empty 2nd input
    fireEvent.keyDown(inputs[1], { key: "Backspace" });

    // Logic Check: Focus moved back
    expect(inputs[0]).toHaveFocus();
  });

  it("handles Arrow keys navigation", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    // Focus 1st, Arrow Right -> 2nd
    inputs[0].focus();
    fireEvent.keyDown(inputs[0], { key: "ArrowRight" });
    expect(inputs[1]).toHaveFocus();

    // Focus 2nd, Arrow Left -> 1st
    fireEvent.keyDown(inputs[1], { key: "ArrowLeft" });
    expect(inputs[0]).toHaveFocus();
  });

  // --- 3. Verification Logic ---

  it("disables verify button if code is incomplete", async () => {
    render(<OtpModal {...defaultProps} />);
    const button = screen.getByRole("button", { name: /Verify Code/i });

    expect(button).toBeDisabled();
  });

  it("handles successful verification flow", async () => {
    mockConfirmSignUp.mockResolvedValue(true);
    mockSignIn.mockResolvedValue(true);
    (postData as jest.Mock).mockResolvedValue({});

    render(<OtpModal {...defaultProps} />);
    let inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    const button = screen.getByRole("button", { name: /Verify Code/i });

    const code = ["0", "1", "2", "3", "4", "5"];

    for (let i = 0; i < code.length; i++) {
      inputs = screen.getAllByRole<HTMLInputElement>("textbox");
      fireEvent.change(inputs[i], { target: { value: code[i] } });
    }

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockConfirmSignUp).toHaveBeenCalledWith(
      defaultProps.email,
      "012345"
    );
    expect(mockSetShowVerifyModal).toHaveBeenCalledWith(false);
    expect(mockSignIn).toHaveBeenCalledWith(
      defaultProps.email,
      defaultProps.password
    );
    expect(postData).toHaveBeenCalledWith("/fhir/v1/user");
    expect(mockPush).toHaveBeenCalledWith("/organizations");
  });

  it("handles confirmSignUp failure (Invalid OTP)", async () => {
    mockConfirmSignUp.mockRejectedValue(new Error("Mismatch"));

    render(<OtpModal {...defaultProps} />);
    let inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    const button = screen.getByRole("button", { name: /Verify Code/i });

    for (let i = 0; i < 6; i++) {
      inputs = screen.getAllByRole<HTMLInputElement>("textbox");
      fireEvent.change(inputs[i], { target: { value: "1" } });
    }

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockConfirmSignUp).toHaveBeenCalled();
    expect(await screen.findByText("Invalid OTP")).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("handles signIn failure after successful confirm", async () => {
    mockConfirmSignUp.mockResolvedValue(true);
    mockSignIn.mockRejectedValue(new Error("Signin failed"));

    render(<OtpModal {...defaultProps} />);
    let inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    const button = screen.getByRole("button", { name: /Verify Code/i });

    for (let i = 0; i < 6; i++) {
      inputs = screen.getAllByRole<HTMLInputElement>("textbox");
      fireEvent.change(inputs[i], { target: { value: "1" } });
    }

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockSignIn).toHaveBeenCalled();
    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sign in failed" })
    );
  });

  it("handles postData failure (calls signOut)", async () => {
    mockConfirmSignUp.mockResolvedValue(true);
    mockSignIn.mockResolvedValue(true);
    (postData as jest.Mock).mockRejectedValue(new Error("FHIR Error"));

    render(<OtpModal {...defaultProps} />);
    let inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    const button = screen.getByRole("button", { name: /Verify Code/i });

    for (let i = 0; i < 6; i++) {
      inputs = screen.getAllByRole<HTMLInputElement>("textbox");
      fireEvent.change(inputs[i], { target: { value: "1" } });
    }

    await act(async () => {
      fireEvent.click(button);
    });

    expect(postData).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sign in failed" })
    );
  });

  // --- 4. Resend Logic ---

  it("handles successful resend code", async () => {
    mockResendCode.mockResolvedValue(true);

    render(<OtpModal {...defaultProps} />);
    const resendLink = screen.getByText("Request New Code");

    let inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    fireEvent.change(inputs[0], { target: { value: "5" } });

    await act(async () => {
      fireEvent.click(resendLink);
    });

    expect(mockResendCode).toHaveBeenCalledWith(defaultProps.email);
    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ errortext: "Code Resent" })
    );

    inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    // Logic Check: Inputs are reset
    expect(inputs[0]).toHaveValue("");

    expect(screen.getByText("02:30 sec")).toBeInTheDocument();
  });

  it("handles resend code failure", async () => {
    mockResendCode.mockRejectedValue(new Error("Network Error"));

    render(<OtpModal {...defaultProps} />);
    const resendLink = screen.getByText("Request New Code");

    await act(async () => {
      fireEvent.click(resendLink);
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network Error" })
    );
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("handles resend code failure with default message", async () => {
    mockResendCode.mockRejectedValue({});

    render(<OtpModal {...defaultProps} />);
    const resendLink = screen.getByText("Request New Code");

    await act(async () => {
      fireEvent.click(resendLink);
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Error resending code." })
    );
  });

  // --- 5. Navigation Links ---

  it("closes modal when 'Change Email' is clicked", () => {
    render(<OtpModal {...defaultProps} />);
    const changeEmailLink = screen.getByText(". Change Email");

    fireEvent.click(changeEmailLink);

    expect(mockSetShowVerifyModal).toHaveBeenCalledWith(false);
  });

  it("calls setShowVerifyModal(false) on modal hide", () => {
    render(<OtpModal {...defaultProps} />);
    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });
    expect(mockSetShowVerifyModal).toHaveBeenCalledWith(false);
  });
});
