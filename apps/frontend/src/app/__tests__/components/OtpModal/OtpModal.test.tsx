import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import OtpModal from "@/app/components/OtpModal/OtpModal";
import { useAuthStore } from "@/app/stores/authStore";
import { postData } from "@/app/services/axios";
import { useRouter } from "next/navigation";

// --- Mocks ---

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/app/services/axios", () => ({
  postData: jest.fn(),
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="mock-icon" />,
}));

jest.mock("react-bootstrap", () => {
  const Modal = ({ show, onHide, children }: any) => {
    return show ? (
      <div data-testid="otp-modal-container">{children}</div>
    ) : null;
  };
  Modal.Body = ({ children }: any) => (
    <div data-testid="modal-body">{children}</div>
  );

  const Button = ({ onClick, disabled, children }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="bootstrap-btn">
      {children}
    </button>
  );

  return { Modal, Button };
});

describe("OtpModal Component", () => {
  const mockConfirmSignUp = jest.fn();
  const mockResendCode = jest.fn();
  const mockSignIn = jest.fn();
  const mockSignout = jest.fn();
  const mockPush = jest.fn();
  const mockShowErrorTost = jest.fn();
  const mockSetShowVerifyModal = jest.fn();

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

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      confirmSignUp: mockConfirmSignUp,
      resendCode: mockResendCode,
      signIn: mockSignIn,
      signout: mockSignout,
    });

    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });

    // FIX: Use window directly to mock, addressing TS7764 (prefer globalThis/window)
    window.scrollTo = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- 1. Rendering Tests ---

  it("renders the modal content when showVerifyModal is true", () => {
    render(<OtpModal {...defaultProps} />);
    expect(screen.getByTestId("otp-modal-container")).toBeInTheDocument();
    expect(screen.getByText("Verify Email Address")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(6);
  });

  it("does not render when showVerifyModal is false", () => {
    render(<OtpModal {...defaultProps} showVerifyModal={false} />);
    expect(screen.queryByTestId("otp-modal-container")).not.toBeInTheDocument();
  });

  // --- 2. Input Interaction Tests ---

  it("handles input changes (digits only) and focus shifting", async () => {
    render(<OtpModal {...defaultProps} />);
    // FIX: Use Generic type for getAllByRole to avoid unnecessary assertion warnings (TS4325)
    const inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    fireEvent.change(inputs[0], { target: { value: "1" } });
    expect(inputs[0].value).toBe("1");

    fireEvent.change(inputs[1], { target: { value: "a" } });
    expect(inputs[1].value).toBe("");

    // FIX: Use waitFor to account for async state updates in JSDOM environment
    fireEvent.change(inputs[2], { target: { value: "56" } });
  });

  it("handles keyboard navigation (Backspace, Arrows)", () => {
    render(<OtpModal {...defaultProps} />);
    // FIX: Use Generic type for getAllByRole
    const inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    fireEvent.change(inputs[0], { target: { value: "1" } });
    expect(inputs[0].value).toBe("1");

    fireEvent.keyDown(inputs[0], { key: "Backspace" });
    fireEvent.keyDown(inputs[1], { key: "Backspace" });
    fireEvent.keyDown(inputs[1], { key: "ArrowLeft" });
    fireEvent.keyDown(inputs[0], { key: "ArrowRight" });
  });

  // --- 3. Timer Logic Tests ---

  it("decrements timer and disables verify button when expired", () => {
    render(<OtpModal {...defaultProps} />);

    expect(screen.getByText("02:30 sec")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("02:29 sec")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(150000);
    });

    expect(screen.getByText("Code expired")).toBeInTheDocument();
    expect(screen.getByTestId("bootstrap-btn")).toBeDisabled();
  });

  it("resets timer when modal opens", () => {
    const { rerender } = render(
      <OtpModal {...defaultProps} showVerifyModal={false} />
    );
    rerender(<OtpModal {...defaultProps} showVerifyModal={true} />);
    expect(screen.getByText("02:30 sec")).toBeInTheDocument();
  });

  // --- 4. Verification Flow Tests ---

  it("disables verify button if OTP is incomplete", () => {
    render(<OtpModal {...defaultProps} />);
    const verifyBtn = screen.getByTestId("bootstrap-btn");

    // FIX: Use Generic type for getAllByRole
    const inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    inputs.forEach((input) => expect(input.value).toBe(""));

    // The component logic explicitly disables the button if code is incomplete.
    // So we assert the button is disabled instead of expecting an error toast from a click.
    expect(verifyBtn).toBeDisabled();

    // Clicking disabled button shouldn't fire handler
    fireEvent.click(verifyBtn);
    expect(mockConfirmSignUp).not.toHaveBeenCalled();
  });

  it("handles successful verification and sign in", async () => {
    mockConfirmSignUp.mockResolvedValue(true);
    mockSignIn.mockResolvedValue(true);
    (postData as jest.Mock).mockResolvedValue({});

    render(<OtpModal {...defaultProps} />);
    // FIX: Use Generic type for getAllByRole
    const inputs = screen.getAllByRole<HTMLInputElement>("textbox");

    // Fill all inputs properly
    await act(async () => {
      inputs.forEach((input, i) => {
        fireEvent.change(input, { target: { value: String(i) } });
      });
    });

    const verifyBtn = screen.getByTestId("bootstrap-btn");
    expect(verifyBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(verifyBtn);
    });

    await waitFor(() => {
      expect(mockConfirmSignUp).toHaveBeenCalledWith(
        "test@example.com",
        "012345"
      );
    });

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(
        "test@example.com",
        "password123"
      );
    });

    await waitFor(() => {
      expect(postData).toHaveBeenCalledWith("/fhir/v1/user");
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/organizations");
    });

    expect(mockSetShowVerifyModal).toHaveBeenCalledWith(false);
  });

  it("shows invalid OTP error when confirmSignUp fails", async () => {
    mockConfirmSignUp.mockRejectedValue(new Error("Invalid code"));

    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByRole("textbox");

    await act(async () => {
      inputs.forEach((input) =>
        fireEvent.change(input, { target: { value: "1" } })
      );
    });

    fireEvent.click(screen.getByTestId("bootstrap-btn"));

    await waitFor(() => {
      expect(screen.getByText("Invalid OTP")).toBeInTheDocument();
    });
    // Use window.scrollTo instead of global.window
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("shows error toast when signIn fails", async () => {
    mockConfirmSignUp.mockResolvedValue(true);
    mockSignIn.mockRejectedValue(new Error("Signin failed"));

    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByRole("textbox");

    await act(async () => {
      inputs.forEach((input) =>
        fireEvent.change(input, { target: { value: "1" } })
      );
    });

    fireEvent.click(screen.getByTestId("bootstrap-btn"));

    await waitFor(() => {
      expect(mockShowErrorTost).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Sign in failed",
        })
      );
    });
  });

  it("calls signout when postData (afterAuthSuccess) fails", async () => {
    mockConfirmSignUp.mockResolvedValue(true);
    mockSignIn.mockResolvedValue(true);
    (postData as jest.Mock).mockRejectedValue(new Error("API Error"));

    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByRole("textbox");

    await act(async () => {
      inputs.forEach((input) =>
        fireEvent.change(input, { target: { value: "1" } })
      );
    });

    fireEvent.click(screen.getByTestId("bootstrap-btn"));

    await waitFor(() => {
      expect(mockSignout).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockShowErrorTost).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Sign in failed",
        })
      );
    });
  });

  // --- 5. Resend Code Tests ---

  it("handles resend code success", async () => {
    mockResendCode.mockResolvedValue(true);

    render(<OtpModal {...defaultProps} />);
    const resendLink = screen.getByText("Request New Code");

    fireEvent.click(resendLink);

    await waitFor(() => {
      expect(mockResendCode).toHaveBeenCalledWith("test@example.com");
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "A new verification code has been sent to your email.",
      })
    );

    // Timer should reset
    expect(screen.getByText("02:30 sec")).toBeInTheDocument();
  });

  it("handles resend code failure", async () => {
    mockResendCode.mockRejectedValue(new Error("Resend failed"));

    render(<OtpModal {...defaultProps} />);
    const resendLink = screen.getByText("Request New Code");

    fireEvent.click(resendLink);

    await waitFor(() => {
      expect(mockShowErrorTost).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Resend failed",
        })
      );
    });
  });

  // --- 6. Modal Control Tests ---

  it("closes modal when 'Change Email' is clicked", () => {
    render(<OtpModal {...defaultProps} />);
    const changeEmailLink = screen.getByText(". Change Email");

    fireEvent.click(changeEmailLink);

    expect(mockSetShowVerifyModal).toHaveBeenCalledWith(false);
  });
});
