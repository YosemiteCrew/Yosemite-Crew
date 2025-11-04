"use client";
import Link from "next/link";
import React, { useState } from "react";
import { Form } from "react-bootstrap";
import { Icon } from "@iconify/react/dist/iconify.js";

import FormInputPass from "@/app/components/Inputs/FormInputPass/FormInputPass";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { useErrorTost } from "@/app/components/Toast/Toast";
import { useAuthStore } from "@/app/stores/authStore";
import OtpModal from "@/app/components/OtpModal/OtpModal";
import { Primary } from "@/app/components/Buttons";

import "./SignIn.css";

const SignIn = () => {
  const { signIn, resendCode } = useAuthStore();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inputErrors, setInputErrors] = useState<{
    email?: string;
    pError?: string;
  }>({});

  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const handleCodeResendonError = async () => {
    try {
      const result = await resendCode(email);
      if (result) {
        setShowVerifyModal(true);
      }
    } catch (error: any) {
      if (globalThis.window) {
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
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { email?: string; pError?: string } = {};
    if (!email) errors.email = "Email is required";
    if (!password) errors.pError = "Password is required";
    setInputErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await signIn(email, password);
    } catch (error: any) {
      if (error?.code === "UserNotConfirmedException") {
        await handleCodeResendonError();
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
      <div className="RightSignIn">
        <Form onSubmit={handleSignIn}>
          <div className="TopSignInner">
            <h2>Sign in to your account</h2>
            <FormInput
              intype="email"
              inname="email"
              value={email}
              inlabel="Email"
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
              error={inputErrors.pError}
            />
            <div className="forgtbtn">
              <Link href="/forgot-password">Forgot password?</Link>
            </div>
          </div>
          <div className="Signbtn">
            <Primary text="Sign in" onClick={handleSignIn} href="#" />
            <h6>
              {" "}
              Don&apos;t have an account? <Link href="/signup">Sign up</Link>
            </h6>
          </div>
        </Form>
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
};

export default SignIn;
