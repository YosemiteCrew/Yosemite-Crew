"use client";
import React, { useState } from "react";
import { AxiosError } from "axios";
import { Form } from "react-bootstrap";
import { GoCheckCircleFill } from "react-icons/go";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react/dist/iconify.js";

import { useErrorTost } from "@/app/components/Toast";
import { useAuthStore } from "@/app/stores/authStore";
import { FormInput, FormInputPass, MainBtn } from "@/app/pages/Sign/SignUp";

import "../Sign/Sign.css";

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
    <section className="SignInSec">
      {ErrorTostPopup}
      <div className="leftSignIn"></div>
      <div className="RightSignIn">
        {!showVerifyCode && !showNewPassword && (
          <div className="SignIninner">
            <div className="ForgetHead">
              <h2>
                Forgot <span>password?</span>{" "}
              </h2>
              <p>
                {" "}
                Enter your registered email, and we’ll send you a code to reset
                it.
              </p>
            </div>
            <Form>
              <FormInput
                intype="email"
                inname="email"
                value={email}
                inlabel="Email Address"
                onChange={(e) => setEmail(e.target.value)}
              />
              <MainBtn
                btnicon={<GoCheckCircleFill />}
                btnname="Send Code"
                onClick={handleOtp}
              />
            </Form>
          </div>
        )}

        {showVerifyCode && (
          <div className="SignIninner">
            <div className="ForgetHead">
              <h2>
                Verify <span>Code</span>{" "}
              </h2>
              <p>
                {" "}
                Enter the code we just sent to your email to proceed with
                resetting your password.
              </p>
            </div>

            <Form style={{ marginBottom: "40px" }}>
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

            <div className="Signbtn">
              <MainBtn
                btnicon={<GoCheckCircleFill />}
                btnname="Change Password"
                iconPosition="left"
                onClick={handleVerifyOtp}
              />
              <h6>
                {" "}
                Didn’t receive the code?{" "}
                <Link onClick={handleOtp} href="#">
                  Request New Code.
                </Link>
              </h6>
            </div>
          </div>
        )}

        {showNewPassword && (
          <div className="SignIninner">
            <Form>
              <div className="TopSignInner">
                <h2>
                  Set <span>new password</span>{" "}
                </h2>
                <FormInputPass
                  intype="password"
                  inPlaceHolder="Enter New Password"
                  inname="password"
                  value={password}
                  inlabel="Enter New Password"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FormInputPass
                  intype="password"
                  inPlaceHolder="Confirm Password"
                  inname="confirmPassword"
                  value={confirmPassword}
                  inlabel="Confirm Password"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="Signbtn">
                <MainBtn
                  btnicon={<GoCheckCircleFill />}
                  btnname="Reset Password"
                  iconPosition="left"
                  onClick={handlePasswordChange}
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
