import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockReplace = jest.fn<void, [string]>();
const mockSearchParamsGet = jest.fn<string | null, [string]>(() => null);
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}));

const showErrorTostMock = jest.fn();
jest.mock("@/app/components/Toast/Toast", () => ({
  useErrorTost: () => ({
    showErrorTost: showErrorTostMock,
    ErrorTostPopup: <div data-testid="toast" />,
  }),
}));

const authStoreMock: any = {
  signIn: jest.fn(),
  resendCode: jest.fn(),
  user: null,
  status: "unauthenticated",
};
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: () => authStoreMock,
}));

let latestOtpModalProps: any;
jest.mock("@/app/components/OtpModal/OtpModal", () => ({
  __esModule: true,
  default: (props: any) => {
    latestOtpModalProps = props;
    return <div data-testid="otp-modal" />;
  },
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
    error,
  }: {
    inlabel: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
  }) => (
    <label>
      {inlabel}
      <input
        type="password"
        aria-label={inlabel}
        value={value}
        onChange={onChange}
      />
      {error && <span>{error}</span>}
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
}));

import SignIn from "@/app/pages/SignIn/SignIn";

describe("SignIn page", () => {
  beforeEach(() => {
    jest.useRealTimers();
    authStoreMock.signIn.mockReset();
    authStoreMock.resendCode.mockReset();
    authStoreMock.user = null;
    authStoreMock.status = "unauthenticated";
    mockReplace.mockReset();
    mockSearchParamsGet.mockReturnValue(null);
    showErrorTostMock.mockReset();
    latestOtpModalProps = undefined;
  });

  const setFieldValue = (label: string, value: string) => {
    fireEvent.change(screen.getByLabelText(label), {
      target: { value },
    });
  };

  test("validates missing credentials before submitting", () => {
    render(<SignIn />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(authStoreMock.signIn).not.toHaveBeenCalled();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });

  test("calls signIn with entered credentials", async () => {
    authStoreMock.signIn.mockResolvedValue(true);
    render(<SignIn />);

    setFieldValue("Email", "user@example.com");
    setFieldValue("Password", "Secret!23");

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(authStoreMock.signIn).toHaveBeenCalledWith(
        "user@example.com",
        "Secret!23"
      )
    );
  });

  test("handles unconfirmed users by resending code and opening OTP modal", async () => {
    authStoreMock.signIn.mockRejectedValue({ code: "UserNotConfirmedException" });
    authStoreMock.resendCode.mockResolvedValue(true);

    render(<SignIn />);
    setFieldValue("Email", "pending@example.com");
    setFieldValue("Password", "Secret!23");

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(authStoreMock.resendCode).toHaveBeenCalledWith(
        "pending@example.com"
      )
    );
    expect(latestOtpModalProps?.showVerifyModal).toBe(true);
  });

  test("redirects authenticated users immediately", async () => {
    authStoreMock.user = { id: "1" };
    authStoreMock.status = "authenticated";
    mockSearchParamsGet.mockReturnValue("/dashboard");

    render(<SignIn />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard")
    );
  });
});
