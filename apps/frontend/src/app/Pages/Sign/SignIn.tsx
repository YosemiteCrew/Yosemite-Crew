"use client";
import Link from "next/link";
import React, { useState } from "react";
import { Form } from "react-bootstrap";
import { GoCheckCircleFill } from "react-icons/go";
import { Icon } from "@iconify/react/dist/iconify.js";

import { FormInput, FormInputPass, MainBtn } from "./SignUp";
import { useErrorTost } from "@/app/Components/Toast";
import { useAuthStore } from "@/app/stores/authStore";
import OtpModal from "@/app/Components/OtpModal/OtpModal";

function SignIn() {
  const { signIn, resendCode } = useAuthStore();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inputErrors, setInputErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { email?: string; password?: string } = {};
    if (!email) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";
    setInputErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await signIn(email, password);
    } catch (error: any) {
      if (error?.code === "UserNotConfirmedException") {
        try {
          const result = await resendCode(email);
          if (result) {
            setShowVerifyModal(true);
          }
        } catch (error: any) {
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          showErrorTost({
            message: error.message || "Error resending code.",
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
      } else {
        showErrorTost({
          message: error.message || `Sign in failed`,
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
    }
  };

  return (
    <section className="SignInSec">
      {ErrorTostPopup}
      <div className="leftSignIn"></div>
      <div className="RightSignIn">
        <div className="SignIninner">
          <Form onSubmit={handleSignIn}>
            <div className="TopSignInner">
              <h2>
                Sign in <span>to your account</span>{" "}
              </h2>
              <FormInput
                intype="email"
                inname="email"
                value={email}
                inlabel="Email Address"
                onChange={(e) => setEmail(e.target.value)}
                error={inputErrors.email}
              />

              <FormInputPass
                inPlaceHolder="Enter your password"
                intype="password"
                inname="password"
                value={password}
                inlabel="Password"
                onChange={(e) => setPassword(e.target.value)}
                error={inputErrors.password}
              />

              <div className="forgtbtn">
                <Link href="/forgotpassword">Forgot Password?</Link>
              </div>
            </div>
            <div className="Signbtn">
              <MainBtn
                btnicon={<GoCheckCircleFill />}
                btnname="Sign in"
                iconPosition="left"
                onClick={handleSignIn}
              />
              <h6>
                {" "}
                Don’t have an account? <Link href="/signup">Sign up.</Link>
              </h6>
            </div>
          </Form>
        </div>
      </div>
      <OtpModal
        email={email}
        password={password}
        showErrorTost={showErrorTost}
        showVerifyModal={showVerifyModal}
        setShowVerifyModal={setShowVerifyModal}
      />
    </section>
  );
}

export default SignIn;
