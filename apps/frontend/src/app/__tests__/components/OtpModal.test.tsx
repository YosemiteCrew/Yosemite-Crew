import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import OtpModal from "@/app/components/OtpModal/OtpModal";
import { useAuthStore } from "@/app/stores/authStore";

jest.mock("@/app/stores/authStore");
const mockConfirmSignUp = jest.fn();
const mockResendCode = jest.fn();
const mockSignIn = jest.fn();

jest.mock("react-bootstrap", () => {
    // FIX: Removed require() from here. 'import React from "react"' is at the top of the file.
    const Modal = ({ show, onHide, children }: { show: boolean; onHide: () => void; children: React.ReactNode }) =>
        show ? (
            <div data-testid="mock-modal">
                {children}
                <button onClick={onHide}>Close</button>
            </div>
        ) : null;
    // FIX: Added display names
    Modal.displayName = 'MockModal';

    Modal.Body = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    Modal.Body.displayName = 'MockModalBody';

    const Button = ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    );
    Button.displayName = 'MockButton';

    return { Modal, Button };
});


jest.mock("next/link", () => {
    const MockLink = ({ children, onClick }: { children: React.ReactNode; onClick: (e: any) => void }) => {
        return (
            <a
                href=""
                onClick={(e) => {
                    e.preventDefault();
                    onClick?.(e);
                }}
            >
                {children}
            </a>
        );
    };
    // FIX: Added display name
    MockLink.displayName = 'MockNextLink';
    return MockLink;
});

jest.mock("@iconify/react/dist/iconify.js", () => ({
    Icon: (props: any) => <span data-testid="mock-icon" data-icon={props.icon} />,
}));

describe("OtpModal Component", () => {
    const mockSetShowVerifyModal = jest.fn();
    const mockShowErrorTost = jest.fn();
    const testEmail = "test@example.com";
    const testPassword = "password123";

    beforeAll(() => {
        window.scrollTo = jest.fn();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        (useAuthStore as unknown as jest.Mock).mockReturnValue({
            confirmSignUp: mockConfirmSignUp,
            resendCode: mockResendCode,
            signIn: mockSignIn,
        });
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("should render the modal with email and initial timer when shown", () => {
        render(
            <OtpModal
                email={testEmail}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        expect(screen.getByRole("heading", { name: "Verify Email Address" })).toBeInTheDocument();
        expect(screen.getByText(testEmail)).toBeInTheDocument();
        expect(screen.getByText("02:30 sec")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Verify Code" })).toBeDisabled();
    });

    it("should enable verify button after a full OTP is entered", async () => {
        const user = userEvent.setup({ delay: null });
        render(
            <OtpModal
                email={testEmail}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        const otpInputs = screen.getAllByRole("textbox");
        expect(otpInputs).toHaveLength(6);

        await user.type(otpInputs[0], "1");
        await user.type(otpInputs[1], "2");
        await user.type(otpInputs[2], "3");
        await user.type(otpInputs[3], "4");
        await user.type(otpInputs[4], "5");
        await user.type(otpInputs[5], "6");

        expect(screen.getByRole("button", { name: "Verify Code" })).toBeEnabled();
    });

    it("should successfully verify and sign in the user", async () => {
        const user = userEvent.setup({ delay: null });
        mockConfirmSignUp.mockResolvedValue(true);
        mockSignIn.mockResolvedValue(true);

        render(
            <OtpModal
                email={testEmail}
                password={testPassword}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        const otpInputs = screen.getAllByRole("textbox");
        await user.type(otpInputs[0], "123456");

        const verifyButton = screen.getByRole("button", { name: "Verify Code" });
        await user.click(verifyButton);

        expect(mockConfirmSignUp).toHaveBeenCalledWith(testEmail, "123456");

        await waitFor(() => {
            expect(mockSignIn).toHaveBeenCalledWith(testEmail, testPassword);
        });

        expect(mockSetShowVerifyModal).toHaveBeenCalledWith(false);
    });

    it("should show an error for invalid OTP on verification failure", async () => {
        const user = userEvent.setup({ delay: null });
        mockConfirmSignUp.mockRejectedValue(new Error("Invalid code"));

        render(
            <OtpModal
                email={testEmail}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        const otpInputs = screen.getAllByRole("textbox");
        await user.type(otpInputs[0], "000000");

        await user.click(screen.getByRole("button", { name: "Verify Code" }));

        expect(mockConfirmSignUp).toHaveBeenCalled();
        expect(await screen.findByText("Invalid OTP")).toBeInTheDocument();
    });

    it("should resend code, show a toast, and reset the timer", async () => {
        const user = userEvent.setup({ delay: null });
        mockResendCode.mockResolvedValue(true);

        render(
            <OtpModal
                email={testEmail}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        act(() => {
            jest.advanceTimersByTime(5000);
        });
        expect(screen.getByText("02:25 sec")).toBeInTheDocument();

        const resendLink = screen.getByText("Request New Code");
        await user.click(resendLink);

        expect(mockResendCode).toHaveBeenCalledWith(testEmail);

        await waitFor(() => {
            expect(mockShowErrorTost).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "A new verification code has been sent to your email.",
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText("02:30 sec")).toBeInTheDocument();
        });
    });

    it("should count down the timer correctly", () => {
        render(
            <OtpModal
                email={testEmail}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        expect(screen.getByText("02:30 sec")).toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(screen.getByText("02:29 sec")).toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(29000);
        });

        expect(screen.getByText("02:00 sec")).toBeInTheDocument();
    });

    it("should keep verify button disabled with an incomplete OTP", async () => {
        const user = userEvent.setup({ delay: null });
        render(
            <OtpModal
                email={testEmail}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        const otpInputs = screen.getAllByRole("textbox");
        await user.type(otpInputs[0], "123");

        const verifyButton = screen.getByRole("button", { name: "Verify Code" });
        expect(verifyButton).toBeDisabled();

        await user.click(verifyButton).catch(() => {});

        expect(mockShowErrorTost).not.toHaveBeenCalled();
    });

    it("should handle sign-in failure after successful verification", async () => {
        const user = userEvent.setup({ delay: null });
        mockConfirmSignUp.mockResolvedValue(true);
        mockSignIn.mockRejectedValue(new Error("Sign-in failed"));

        render(
            <OtpModal
                email={testEmail}
                password={testPassword}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        const otpInputs = screen.getAllByRole("textbox");
        await user.type(otpInputs[0], "123456");
        await user.click(screen.getByRole("button", { name: "Verify Code" }));

        await waitFor(() => {
            expect(mockSignIn).toHaveBeenCalled();
        });

        expect(mockShowErrorTost).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Sign in failed" })
        );
    });

    it("should handle resend code failure", async () => {
        const user = userEvent.setup({ delay: null });
        mockResendCode.mockRejectedValue(new Error("Resend failed"));

        render(
            <OtpModal
                email={testEmail}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        const resendLink = screen.getByText("Request New Code");
        await user.click(resendLink);

        await waitFor(() => {
            expect(mockShowErrorTost).toHaveBeenCalledWith(
                expect.objectContaining({ message: "Resend failed" })
            );
        });
    });

    it("should handle keyboard navigation correctly", async () => {
        const user = userEvent.setup({ delay: null });
        render(
            <OtpModal
                email={testEmail}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        let otpInputs = screen.getAllByRole("textbox");
        expect(otpInputs[0]).toHaveFocus();

        await user.type(otpInputs[0], "1");
        otpInputs = screen.getAllByRole("textbox");
        expect(otpInputs[1]).toHaveFocus();

        await user.keyboard("{ArrowRight}");
        expect(otpInputs[2]).toHaveFocus();

        await user.keyboard("{ArrowLeft}");
        expect(otpInputs[1]).toHaveFocus();

        await user.type(otpInputs[1], '2');
        otpInputs = screen.getAllByRole("textbox");
        otpInputs[1].focus();
        expect(otpInputs[1]).toHaveFocus();
        await user.keyboard('{Backspace}');
        otpInputs = screen.getAllByRole("textbox");
        expect(otpInputs[1]).toHaveValue("");

        await user.keyboard('{Backspace}');
    });

    it('should display "Code expired" when timer reaches zero', () => {
        render(
            <OtpModal
                email={testEmail}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );

        act(() => {
            jest.advanceTimersByTime(150000);
        });

        expect(screen.getByText("Code expired")).toBeInTheDocument();
    });

    it('should not change value if non-numeric input is provided', async () => {
        const user = userEvent.setup({ delay: null });
        render(
            <OtpModal
                email={testEmail}
                showErrorTost={mockShowErrorTost}
                showVerifyModal={true}
                setShowVerifyModal={mockSetShowVerifyModal}
            />
        );
        const otpInputs = screen.getAllByRole('textbox');
        await user.type(otpInputs[0], 'a');
        expect(otpInputs[0]).toHaveValue('');
    });
});