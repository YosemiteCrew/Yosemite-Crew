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

import "../AuthPages.css";

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
          flex h-fit w-[min(520px,90vw)] flex-col items-center justify-center gap-6
          rounded-3xl border border-card-border
          bg-(--whitebg)
          p-[1.5rem]
          sm:p-[1.75rem]
          elevation-1
        `}
      >
        <Form
          onSubmit={handleSignIn}
          className="flex h-full w-full flex-col gap-6"
        >
          <div className="flex w-full flex-col gap-6">
            <div className="text-display-2 text-text-primary text-center auth-title">
              {isDeveloper
                ? "Sign in to your developer account"
                : "Sign in"}
            </div>
            <div className="flex w-full flex-col gap-3">
              <FormInput
                intype="email"
                inname="email"
                value={email}
                inlabel="Email"
                onChange={(e) => setEmail(e.target.value)}
                error={inputErrors.email}
              />
              <FormInputPass
                intype="password"
                inname="password"
                value={password}
                inlabel="Password"
                onChange={(e) => setPassword(e.target.value)}
                error={inputErrors.pError}
              />
              <div className="flex items-end justify-end">
                <Link
                  href="/forgot-password"
                  className="text-body-4-emphasis text-text-primary! auth-link-text"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 items-center">
            <Primary
              text="Sign in"
              onClick={handleSignIn}
              href="#"
              style={{ width: "100%" }}
            />
            <div className="text-body-4 text-text-primary auth-inline-text">
              {" "}
              Don&apos;t have an account?{" "}
              <Link href={signupHref} className="text-text-brand">
                Sign up
              </Link>
            </div>
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
