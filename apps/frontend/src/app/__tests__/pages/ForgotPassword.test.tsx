import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";

const showErrorTostMock = jest.fn();
jest.mock("@/app/components/Toast/Toast", () => ({
  useErrorTost: () => ({
    showErrorTost: showErrorTostMock,
    ErrorTostPopup: <div data-testid="toast" />,
  }),
}));

const authStoreMock: any = {
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
};
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => authStoreMock,
}));

const mockRouterPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({
    inlabel,
    value,
    onChange,
    error,
  }: {
    inlabel: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
  }) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value} onChange={onChange} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/FormInputPass/FormInputPass", () => ({
  __esModule: true,
  default: ({
    inlabel,
    value,
    onChange,
  }: {
    inlabel: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <label>
      {inlabel}
      <input
        type="password"
        aria-label={inlabel}
        value={value}
        onChange={onChange}
      />
    </label>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({
    text,
    onClick,
  }: {
    text: string;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  }) => (
    <button type="button" onClick={(e) => onClick?.(e)}>
      {text}
    </button>
  ),
  Secondary: ({
    text,
    onClick,
  }: {
    text: string;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  }) => (
    <button type="button" onClick={(e) => onClick?.(e)}>
      {text}
    </button>
  ),
}));

jest.mock("next/link", () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

import ForgotPassword from "@/app/pages/ForgotPassword/ForgotPassword";

describe("ForgotPassword page", () => {
  beforeAll(() => {
    (globalThis as any).window.scrollTo = jest.fn();
  });

  beforeEach(() => {
    jest.useRealTimers();
    authStoreMock.forgotPassword.mockReset();
    authStoreMock.resetPassword.mockReset();
    showErrorTostMock.mockReset();
    mockRouterPush.mockReset();
  });

  test("requires email before sending code", () => {
    render(<ForgotPassword />);

    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Email is required" })
    );
    expect(authStoreMock.forgotPassword).not.toHaveBeenCalled();
  });

  test("moves to verify step after requesting OTP", async () => {
    authStoreMock.forgotPassword.mockResolvedValue(true);
    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() =>
      expect(authStoreMock.forgotPassword).toHaveBeenCalledWith(
        "user@example.com"
      )
    );
    expect(
      await screen.findByRole("heading", { name: "Verify code" })
    ).toBeInTheDocument();
  });

  test("requires full OTP before verifying", async () => {
    authStoreMock.forgotPassword.mockResolvedValue(true);
    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByRole("heading", { name: "Verify code" });

    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Please enter the full OTP" })
    );
  });

  test("resets password after verifying code", async () => {
    jest.useFakeTimers();
    authStoreMock.forgotPassword.mockResolvedValue(true);
    authStoreMock.resetPassword.mockResolvedValue(true);
    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByRole("heading", { name: "Verify code" });

    const otpInputs = screen.getAllByRole("textbox");
    let index = 0;
    for (const input of otpInputs) {
      fireEvent.change(input, { target: { value: String(index + 1) } });
      index++;
    }

    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await screen.findByRole("heading", { name: "Set new password" });

    fireEvent.change(screen.getByLabelText("Enter New Password"), {
      target: { value: "Secret!23" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Secret!23" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() =>
      expect(authStoreMock.resetPassword).toHaveBeenCalledWith(
        "user@example.com",
        "123456",
        "Secret!23"
      )
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(mockRouterPush).toHaveBeenCalledWith("/signin");
  });
});
