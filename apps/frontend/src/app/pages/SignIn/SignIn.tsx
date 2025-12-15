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
import { useRouter } from "next/navigation";

import "./SignIn.css";

type SignInProps = {
  redirectPath?: string;
  signupHref?: string;
  allowNext?: boolean;
  isDeveloper?: boolean;
};

const SignIn = ({
  redirectPath = "/organizations",
  signupHref = "/signup",
  allowNext = true,
  isDeveloper = false,
}: Readonly<SignInProps>) => {
  const { signIn, resendCode } = useAuthStore();
  const router = useRouter();
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
      router.push("/organizations");
      if (typeof globalThis !== "undefined") {
        // Temporary fallback until custom:role attribute is available in the pool
        globalThis.sessionStorage?.setItem(
          "devAuth",
          isDeveloper ? "true" : "false"
        );
      }
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
    <section
      className="SignInSec"
      style={
        isDeveloper
          ? {
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.55)), url("/assets/bgDev.jpg")',
            }
          : undefined
      }
    >
      {ErrorTostPopup}
      <div className="RightSignIn">
        <Form onSubmit={handleSignIn}>
          <div className="TopSignInner">
            <h2>
              {isDeveloper
                ? "Sign in to your developer account"
                : "Sign in to your account"}
            </h2>
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
            <Primary
              text="Sign in"
              onClick={handleSignIn}
              href="#"
              style={{ width: "100%" }}
            />
            <h6>
              {" "}
              Don&apos;t have an account? <Link href={signupHref}>Sign up</Link>
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
