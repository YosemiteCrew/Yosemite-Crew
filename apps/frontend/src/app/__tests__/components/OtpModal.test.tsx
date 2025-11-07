import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const confirmSignUp = jest.fn();
const resendCode = jest.fn();
const signIn = jest.fn();

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => ({
    confirmSignUp,
    resendCode,
    signIn,
  }),
}));

jest.mock("react-bootstrap", () => {
  const Modal = ({ children, show }: any) =>
    show ? <div data-testid="modal">{children}</div> : null;

  (Modal as any).Body = ({ children }: any) => (
    <div data-testid="modal-body">{children}</div>
  );

  const Button = ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  );

  return { Modal, Button };
});

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="icon" />,
}));

import OtpModal from "@/app/components/OtpModal/OtpModal";

const defaultProps = {
  email: "test@example.com",
  password: "secret",
  showErrorTost: jest.fn(),
  showVerifyModal: true,
  setShowVerifyModal: jest.fn(),
};

const enterOtp = () => {
  const inputs = screen.getAllByRole("textbox");
  let idx = 0;
  for (const input of inputs) {
    fireEvent.change(input, { target: { value: String(++idx) } });
  }
};

describe("OtpModal", () => {
  beforeEach(() => {
    confirmSignUp.mockResolvedValue(true);
    signIn.mockResolvedValue(true);
    resendCode.mockResolvedValue(true);
    defaultProps.showErrorTost.mockReset();
    defaultProps.setShowVerifyModal.mockReset();
  });

  test("verifies OTP and signs user in", async () => {
    render(<OtpModal {...defaultProps} />);
    enterOtp();

    fireEvent.click(screen.getByText("Verify Code"));

    await waitFor(() =>
      expect(confirmSignUp).toHaveBeenCalledWith("test@example.com", "123456")
    );
    expect(signIn).toHaveBeenCalledWith("test@example.com", "secret");
    expect(defaultProps.setShowVerifyModal).toHaveBeenCalledWith(false);
  });

  test("shows error message when verification fails", async () => {
    confirmSignUp.mockRejectedValueOnce(new Error("Invalid"));
    render(<OtpModal {...defaultProps} />);
    enterOtp();

    fireEvent.click(screen.getByText("Verify Code"));
    expect(await screen.findByText(/Invalid OTP/i)).toBeInTheDocument();
  });

  test("resends OTP when requested", async () => {
    render(<OtpModal {...defaultProps} />);
    const resendLink = screen.getByText("Request New Code");
    fireEvent.click(resendLink);

    await waitFor(() =>
      expect(resendCode).toHaveBeenCalledWith("test@example.com")
    );
    await waitFor(() => expect(defaultProps.showErrorTost).toHaveBeenCalled());
  });
});
