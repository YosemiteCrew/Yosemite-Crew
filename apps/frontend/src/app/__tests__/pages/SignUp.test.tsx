import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const showErrorTostMock = jest.fn();
jest.mock("@/app/components/Toast/Toast", () => ({
  useErrorTost: () => ({
    showErrorTost: showErrorTostMock,
    ErrorTostPopup: <div data-testid="toast" />,
  }),
}));

const authStoreMock: any = {
  signUp: jest.fn(),
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

jest.mock("react-bootstrap", () => {
  const MockContainer = ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  );
  const MockForm = ({
    children,
    onSubmit,
  }: {
    children: React.ReactNode;
    onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(e);
      }}
    >
      {children}
    </form>
  );
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
  (MockForm as any).Check = ({
    label,
    onChange,
    ...rest
  }: {
    label: React.ReactNode;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <label>
      <input
        type="checkbox"
        onChange={(e) => {
          e.persist?.();
          onChange?.(e);
        }}
        {...rest}
      />
      {label}
    </label>
  );
  return {
    Col: MockContainer,
    Row: MockContainer,
    Form: MockForm,
  };
});

import SignUp from "@/app/pages/SignUp/SignUp";

describe("SignUp page", () => {
  beforeEach(() => {
    authStoreMock.signUp.mockReset();
    showErrorTostMock.mockReset();
    latestOtpModalProps = undefined;
  });

  const setFieldValue = (label: string, value: string) => {
    fireEvent.change(screen.getByLabelText(label), {
      target: { value },
    });
  };

  const checkAllBoxes = () => {
    const checkboxes = screen.getAllByRole("checkbox");
    for (const checkbox of checkboxes) {
      if (!(checkbox as HTMLInputElement).checked) {
        fireEvent.click(checkbox);
      }
    }
  };

  test("validates inputs before submitting", () => {
    render(<SignUp />);
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(authStoreMock.signUp).not.toHaveBeenCalled();
    expect(screen.getByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(
      screen.getByText("Confirm Password is required")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Please check the Newsletter and Promotional emails box")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Please check the Terms and Conditions box")
    ).toBeInTheDocument();
  });

  test("submits signup data and opens verification modal", async () => {
    authStoreMock.signUp.mockResolvedValue(true);
    render(<SignUp />);

    setFieldValue("First name", "Jane");
    setFieldValue("Last name", "Doe");
    setFieldValue("Enter email", "jane@example.com");
    setFieldValue("Set up password", "Secret!23");
    setFieldValue("Confirm password", "Secret!23");
    checkAllBoxes();
fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() =>
      expect(authStoreMock.signUp).toHaveBeenCalledWith(
        "jane@example.com",
        "Secret!23",
        "Jane",
        "Doe"
      )
    );
    expect(latestOtpModalProps?.showVerifyModal).toBe(true);
  });

  test("surfaces toast error when Cognito returns UsernameExistsException", async () => {
    authStoreMock.signUp.mockRejectedValue({
      code: "UsernameExistsException",
      message: "Already exists",
    });
    render(<SignUp />);

    setFieldValue("First name", "Jane");
    setFieldValue("Last name", "Doe");
    setFieldValue("Enter email", "jane@example.com");
    setFieldValue("Set up password", "Secret!23");
    setFieldValue("Confirm password", "Secret!23");
    checkAllBoxes();
fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(showErrorTostMock).toHaveBeenCalled());
    expect(latestOtpModalProps?.showVerifyModal).toBeFalsy();
  });
});
