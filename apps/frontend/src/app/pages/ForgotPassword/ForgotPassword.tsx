"use client";
import React, { useState } from "react";
import { AxiosError } from "axios";
import { Form } from "react-bootstrap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react/dist/iconify.js";

import { useErrorTost } from "@/app/components/Toast/Toast";
import { useAuthStore } from "@/app/stores/authStore";
import FormInputPass from "@/app/components/Inputs/FormInputPass/FormInputPass";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";

import "./ForgotPassword.css";
import { Primary, Secondary } from "@/app/components/Buttons";

const ForgotPassword = () => {
  const router = useRouter();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const { forgotPassword, resetPassword } = useAuthStore();

  const [showVerifyCode, setShowVerifyCode] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number
  ) => {
    const value = e.target.value;

    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < otp.length - 1) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number
  ) => {
    if (e.key === "Backspace" && otp[index] === "") {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      if (globalThis.window) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showErrorTost({
        message: "Email is required",
        errortext: "Error",
        iconElement: (
          <Icon
            icon="solar:danger-triangle-bold"
            width="20"
            height="20"
            color="#EA3729"
          />
        ),
        className: "errofoundbg",
      });
      return;
    }

    try {
      const data = await forgotPassword(email);
      if (data) {
        if (globalThis.window) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        showErrorTost({
          message:
            "If an account with this email exists, a reset code has been sent",
          errortext: "Success",
          iconElement: (
            <Icon
              icon="solar:danger-triangle-bold"
              width="20"
              height="20"
              color="#00C853"
            />
          ),
          className: "CongratsBg",
        });
        setShowVerifyCode(true);
      }
    } catch (error: unknown) {
      if (globalThis.window) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      const axiosError = error as AxiosError<{ message: string }>;
      showErrorTost({
        message: `OTP failed: ${axiosError.response?.data?.message || "Unable to connect to the server."}`,
        errortext: "Error",
        iconElement: (
          <Icon
            icon="solar:danger-triangle-bold"
            width="20"
            height="20"
            color="#EA3729"
          />
        ),
        className: "errofoundbg",
      });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.includes("")) {
      if (globalThis.window) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showErrorTost({
        message: "Please enter the full OTP",
        errortext: "Error",
        iconElement: (
          <Icon
            icon="solar:danger-triangle-bold"
            width="20"
            height="20"
            color="#EA3729"
          />
        ),
        className: "errofoundbg",
      });
      return;
    }

    setShowNewPassword(true);
    setShowVerifyCode(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      if (globalThis.window) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showErrorTost({
        message: "Both Passwords are required",
        errortext: "Error",
        iconElement: (
          <Icon
            icon="solar:danger-triangle-bold"
            width="20"
            height="20"
            color="#EA3729"
          />
        ),
        className: "errofoundbg",
      });
      return;
    }

    if (password !== confirmPassword) {
      if (globalThis.window) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showErrorTost({
        message: "Passwords do not match",
        errortext: "Error",
        iconElement: (
          <Icon
            icon="solar:danger-triangle-bold"
            width="20"
            height="20"
            color="#EA3729"
          />
        ),
        className: "errofoundbg",
      });
      return;
    }

    try {
      const success = await resetPassword(email, otp.join(""), password);
      if (success) {
        showErrorTost({
          message: "Password Changed successfully",
          errortext: "Success",
          iconElement: (
            <Icon
              icon="solar:danger-triangle-bold"
              width="20"
              height="20"
              color="#00C853"
            />
          ),
          className: "CongratsBg",
        });
        setTimeout(() => {
          router.push("/signin");
        }, 3000);
        setTimeout(() => {
          setShowNewPassword(false);
          setShowVerifyCode(false);
          setPassword("");
          setConfirmPassword("");
          setOtp(["", "", "", "", "", ""]);
        }, 5000);
      }
    } catch (error: any) {
      if (globalThis.window) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (error?.code === "CodeMismatchException") {
        setShowVerifyCode(true);
        showErrorTost({
          message: "Code Mismatch",
          errortext: "Error",
          iconElement: (
            <Icon
              icon="solar:danger-triangle-bold"
              width="20"
              height="20"
              color="#EA3729"
            />
          ),
          className: "errofoundbg",
        });
      } else {
        setShowVerifyCode(false);
        showErrorTost({
          message: "Something went wrong",
          errortext: "Error",
          iconElement: (
            <Icon
              icon="solar:danger-triangle-bold"
              width="20"
              height="20"
              color="#EA3729"
            />
          ),
          className: "errofoundbg",
        });
      }
      setShowNewPassword(false);
      setPassword("");
      setConfirmPassword("");
      setOtp(["", "", "", "", "", ""]);
    }
  };

  return (
    <section
      className={`
        relative flex w-full flex-1 items-center justify-center
        bg-[url('https://d2il6osz49gpup.cloudfront.net/Images/SignUpBg.png')]
        bg-cover bg-center bg-no-repeat
        h-[calc(100vh-80px)]
      `}
    >
      {ErrorTostPopup}
      <div
        className={`
          flex h-fit w-[450px] flex-col items-center justify-center gap-6
          rounded-3xl border border-card-border
          bg-(--whitebg)
          p-[1.25rem]
          elevation-1
        `}
      >
        {!showVerifyCode && !showNewPassword && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="text-display-2 text-text-primary text-center">
                Forgot password?
              </div>
              <div className="text-body-4 text-text-primary text-center">
                {" "}
                Enter your registered email, and we’ll send you a code to reset
                it.
              </div>
            </div>
            <Form className="flex flex-col gap-6">
              <FormInput
                intype="email"
                inname="email"
                value={email}
                inlabel="Email Address"
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="flex flex-col gap-2">
                <Primary href="#" onClick={handleOtp} text="Send code" />
                <Secondary href="/signin" text="Back" />
              </div>
            </Form>
          </div>
        )}

        {showVerifyCode && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="text-display-2 text-text-primary text-center">
                Verify code
              </div>
              <div className="text-body-4 text-text-primary text-center">
                {" "}
                Enter the code we just sent to your email to proceed with
                resetting your password.
              </div>
            </div>

            <Form style={{ marginBottom: "0px" }}>
              <div className="verifyInput">
                {otp.map((digit, index) => (
                  <Form.Control
                    key={`${digit}-${index}`}
                    type="text"
                    value={digit}
                    id={`otp-input-${index}`}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)} // Handle backspace
                    maxLength={1}
                  />
                ))}
              </div>
            </Form>

            <div className="flex flex-col gap-3 items-center w-full">
              <Primary
                href="#"
                onClick={handleVerifyOtp}
                text="Verify code"
                style={{ width: "100%" }}
              />
              <Secondary
                href="#"
                text="Back"
                onClick={() => setShowVerifyCode(false)}
                style={{ width: "100%" }}
              />
              <div className="text-body-4 text-text-primary">
                {" "}
                Didn&apos;t receive the code?{" "}
                <Link href="#" onClick={handleOtp} className="text-text-brand">
                  Request New Code
                </Link>
              </div>
            </div>
          </div>
        )}

        {showNewPassword && (
          <div className="flex flex-col gap-6 w-full">
            <Form className="flex flex-col gap-6 w-full">
              <div className="flex flex-col gap-6 w-full">
                <div className="text-display-2 text-text-primary text-center">
                  Set new password
                </div>
                <div className="flex flex-col gap-3">
                  <FormInputPass
                    intype="password"
                    inname="password"
                    value={password}
                    inlabel="Enter New Password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <FormInputPass
                    intype="password"
                    inname="confirmPassword"
                    value={confirmPassword}
                    inlabel="Confirm Password"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <Primary
                  href="#"
                  onClick={handlePasswordChange}
                  text="Reset password"
                />
                <Secondary
                  href="#"
                  text="Back"
                  onClick={() => setShowNewPassword(false)}
                />
              </div>
            </Form>
          </div>
        )}
      </div>
      {ErrorTostPopup}
    </section>
  );
};

export default ForgotPassword;
